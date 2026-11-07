/**
 * The review console: a local web page where the user reads the story, picks a
 * style, checks the storyboard and every pair of keyframes, sets the budget and
 * approves or sends things back with a comment. It never spends money and never
 * edits the plan — it only writes approvals.json, which the engine checks before
 * every paid call.
 *
 * It listens on 127.0.0.1 only. Because any web page can try to reach a localhost
 * port, every request must carry the right Host header (no DNS rebinding) and every
 * API or file request a per-run token that only the page we served knows.
 */

import { createServer } from 'node:http'
import { readFile, writeFile, rename, stat, readdir } from 'node:fs/promises'
import { createReadStream, existsSync } from 'node:fs'
import { join, resolve, extname, dirname, sep } from 'node:path'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { openProject, readApprovals, currentHash, approvalKeys } from '../engine/project.mjs'
import { summary } from '../engine/status.mjs'
import { listStyles } from '../engine/styles.mjs'

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), 'public')
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4',
  '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.json': 'application/json; charset=utf-8',
}
const MEDIA = new Set(['.png', '.jpg', '.jpeg', '.webp', '.mp4', '.mov', '.mp3', '.wav'])

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}
const httpError = (status, message) => Object.assign(new Error(message), { status })

async function readBody(req) {
  let size = 0
  const chunks = []
  for await (const c of req) {
    size += c.length
    if (size > 256 * 1024) throw httpError(413, 'request too large')
    chunks.push(c)
  }
  try { return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {} } catch { throw httpError(400, 'invalid JSON') }
}

/** Approvals are written atomically and only here. */
async function writeApprovals(dir, mutate) {
  const file = join(dir, 'approvals.json')
  const a = await readApprovals(dir)
  mutate(a)
  a.log = a.log.slice(-500)
  const tmp = `${file}.tmp-${process.pid}`
  await writeFile(tmp, JSON.stringify(a, null, 2) + '\n')
  await rename(tmp, file)
  return a
}

/**
 * Start the console for one folder of projects (or one project). Returns
 * { url, port, token, close }. `root` is either a project folder (has director.json)
 * or a folder that contains project folders.
 */
export async function startConsole({ root, port = 0, host = '127.0.0.1' } = {}) {
  root = resolve(root)
  const token = randomBytes(24).toString('base64url')
  const single = existsSync(join(root, 'director.json'))

  const projectDir = (id) => {
    if (single) return root
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(id || '')) throw httpError(404, 'unknown project')
    const dir = join(root, id)
    if (!existsSync(join(dir, 'director.json'))) throw httpError(404, 'unknown project')
    return dir
  }

  async function listProjects() {
    if (single) return [{ id: '_', title: (await openProject(root)).data.title }]
    const out = []
    for (const name of await readdir(root).catch(() => [])) {
      const dir = join(root, name)
      if (!existsSync(join(dir, 'director.json'))) continue
      try {
        const proj = await openProject(dir)
        out.push({ id: name, title: proj.data.title, shots: proj.data.shots.length, updatedAt: (await stat(proj.file)).mtimeMs })
      } catch { /* not readable */ }
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async function view(dir) {
    const proj = await openProject(dir)
    const sum = await summary(proj)
    const approvals = await readApprovals(dir)
    return { project: proj.data, summary: sum, history: approvals.log.slice(-50).reverse() }
  }

  async function decide(dir, b) {
    const proj = await openProject(dir)
    const keys = approvalKeys(proj.data)
    if (!keys.includes(b.key)) throw httpError(400, `unknown item ${b.key}`)
    if (!['approved', 'rejected'].includes(b.status)) throw httpError(400, 'status must be approved or rejected')
    const comment = String(b.comment ?? '').slice(0, 4000)
    if (b.status === 'rejected' && !comment.trim()) throw httpError(400, 'say what to change when sending something back')
    // Bind the decision to what is on disk right now. The page sends the hash it was
    // showing; if the agent changed the item in the meantime, refuse, so the user
    // never approves something they did not see.
    const hash = await currentHash(proj, b.key)
    if (b.hash && b.hash !== hash) throw httpError(409, 'this item changed while you were looking at it — the page has been refreshed, check it again')
    if (b.key === 'settings' && b.status === 'approved') {
      const budget = Number(b.budget_usd)
      if (!(budget > 0)) throw httpError(400, 'set a budget (USD) before confirming the settings')
    }
    const at = new Date().toISOString()
    return writeApprovals(dir, (a) => {
      a.items[b.key] = { status: b.status, hash, comment, at }
      if (b.key === 'settings' && b.status === 'approved') a.budget_usd = Math.round(Number(b.budget_usd) * 100) / 100
      a.log.push({ at, key: b.key, status: b.status, comment, ...(b.key === 'settings' && b.status === 'approved' ? { budget_usd: a.budget_usd } : {}) })
    })
  }

  async function pick(dir, b) {
    const proj = await openProject(dir)
    const at = new Date().toISOString()
    if (b.kind === 'style') {
      if (!listStyles().some((s) => s.id === b.value)) throw httpError(400, 'unknown style')
      return writeApprovals(dir, (a) => { a.style_pick = b.value; a.log.push({ at, key: 'style_pick', status: 'picked', comment: b.value }) })
    }
    if (b.kind === 'take') {
      const s = proj.data.shots.find((x) => x.id === b.shot)
      if (!s || !(s.takes || []).some((t) => t.take === Number(b.value) && t.state === 'done')) throw httpError(400, 'unknown take')
      return writeApprovals(dir, (a) => { a.take_pick[b.shot] = Number(b.value); a.log.push({ at, key: `take:${b.shot}`, status: 'picked', comment: `take ${b.value}` }) })
    }
    if (b.kind === 'budget') {
      const budget = Number(b.value)
      if (!(budget >= 0)) throw httpError(400, 'budget must be a number')
      return writeApprovals(dir, (a) => { a.budget_usd = Math.round(budget * 100) / 100; a.log.push({ at, key: 'budget', status: 'set', comment: `$${a.budget_usd}` }) })
    }
    if (b.kind === 'note') {
      const text = String(b.value ?? '').slice(0, 4000)
      if (!text.trim()) throw httpError(400, 'empty note')
      return writeApprovals(dir, (a) => { a.log.push({ at, key: String(b.key || 'note').slice(0, 64), status: 'note', comment: text }) })
    }
    throw httpError(400, 'unknown pick')
  }

  async function sendFile(res, dir, rel) {
    const full = resolve(dir, rel)
    if (!full.startsWith(dir + sep) || !MEDIA.has(extname(full).toLowerCase())) throw httpError(404, 'not found')
    const s = await stat(full).catch(() => null)
    if (!s?.isFile()) throw httpError(404, 'not found')
    res.writeHead(200, { 'Content-Type': TYPES[extname(full).toLowerCase()], 'Content-Length': s.size, 'Cache-Control': 'no-cache' })
    createReadStream(full).pipe(res)
  }

  let actualPort = port
  const server = createServer(async (req, res) => {
    try {
      const u = new URL(req.url, 'http://127.0.0.1')
      const hostOk = req.headers.host === `127.0.0.1:${actualPort}` || req.headers.host === `localhost:${actualPort}`
      if (!hostOk) throw httpError(403, 'bad host')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Referrer-Policy', 'no-referrer')

      if (u.pathname === '/' || u.pathname === '/index.html') {
        const html = (await readFile(join(PUBLIC, 'index.html'), 'utf8')).replace('__TOKEN__', token)
        res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; img-src 'self' blob:; media-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'" })
        return res.end(html)
      }
      if (/^\/(app\.js|app\.css)$/.test(u.pathname)) {
        res.writeHead(200, { 'Content-Type': TYPES[extname(u.pathname)], 'Cache-Control': 'no-cache' })
        return res.end(await readFile(join(PUBLIC, u.pathname.slice(1))))
      }

      // Everything below needs the token: header for API calls, query for <img>/<video>.
      const t = req.headers['x-director-token'] || u.searchParams.get('t')
      if (t !== token) throw httpError(401, 'missing or wrong token — reopen the console link')

      if (u.pathname === '/api/projects' && req.method === 'GET') return json(res, 200, { single, projects: await listProjects() })
      if (u.pathname === '/api/styles' && req.method === 'GET') return json(res, 200, { styles: listStyles(u.searchParams.get('lang') || 'en') })
      const m = u.pathname.match(/^\/api\/p\/([^/]+)\/(view|decide|pick|file)$/)
      if (!m) throw httpError(404, 'not found')
      const dir = projectDir(decodeURIComponent(m[1]))
      if (m[2] === 'view' && req.method === 'GET') return json(res, 200, await view(dir))
      // await, not a bare return: a rejection must land in the catch below and get a 404.
      if (m[2] === 'file' && req.method === 'GET') return await sendFile(res, dir, u.searchParams.get('path') || '')
      if (req.method !== 'POST') throw httpError(405, 'method not allowed')
      // A form post from another site cannot set this header, so this also blocks CSRF.
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw httpError(415, 'JSON only')
      const b = await readBody(req)
      if (m[2] === 'decide') { await decide(dir, b); return json(res, 200, await view(dir)) }
      if (m[2] === 'pick') { await pick(dir, b); return json(res, 200, await view(dir)) }
      throw httpError(404, 'not found')
    } catch (e) {
      if (!res.headersSent) json(res, e.status || 500, { error: e.message })
      else res.end()
    }
  })
  await new Promise((ok, no) => { server.once('error', no); server.listen(port, host, ok) })
  actualPort = server.address().port
  const url = `http://127.0.0.1:${actualPort}/`
  // closeAllConnections: an open video stream or keep-alive socket must not hold the process.
  const close = () => new Promise((r) => { server.close(() => r()); server.closeAllConnections?.() })
  return { url, port: actualPort, token, root, single, close }
}
