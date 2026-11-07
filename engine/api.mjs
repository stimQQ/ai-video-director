/**
 * Talking to apimodels.app: the API key, one call, task polling, billed amounts,
 * uploads and downloads. Shared by the MCP server, the console and the CLI.
 *
 * One key covers every model this project uses (image models for keyframes,
 * Seedance for the shots), so there is no second account to set up.
 */

import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, chmod, rename } from 'node:fs/promises'
import { join, basename, extname, dirname } from 'node:path'
import { homedir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { execFile } from 'node:child_process'

// Same variable as the apimodels MCP server; the offline tests point it at a fake API.
export const API = (process.env.APIMODELS_BASE_URL || 'https://api.apimodels.app/v1').replace(/\/$/, '')
export const CONSOLE_URL = 'https://apimodels.app/console/api-keys'
const CRED_DIR = join(homedir(), '.apimodels')
const CRED_FILE = join(CRED_DIR, 'credentials')
// Written by `npx apimodels-mcp login` ({ "api_key": "sk_…" }). Read too, so one
// login covers the apimodels MCP server and every apimodels skill.
const MCP_CRED_FILE = join(CRED_DIR, 'credentials.json')

/**
 * List prices in USD (apimodels.app model pages, checked 2026-11-06). They feed the
 * estimate and the budget check only; what a task really cost is read back from
 * GET /v1/records/<task id> and that is the number the budget counts.
 */
export const VIDEO_PRICES = { // per second of output
  'dreamina-seedance-2-0-mini': { '480p': 0.0225, '720p': 0.048 },
  'seedance-2.0-mini': { '480p': 0.044, '720p': 0.095 },
  'seedance-2.0-fast': { '480p': 0.071, '720p': 0.153 },
  'seedance-2.0': { '480p': 0.092, '720p': 0.197, '1080p': 0.492 },
  'seedance-2.5': { '480p': 0.12, '720p': 0.26, '1080p': 0.65 },
}
export const IMAGE_PRICES = { // per image
  'gpt-image-2': { '1K': 0.025, '2K': 0.04, '4K': 0.08 },
  'nano-banana-2-1': { '1K': 0.022, '2K': 0.036, '4K': 0.06 },
}
// Seedance takes whole seconds in this range for first/last-frame shots.
export const VIDEO_SECONDS = { min: 4, max: 15 }

export const imagePrice = (model, res) => IMAGE_PRICES[model]?.[res] ?? null
export const videoPrice = (model, res, seconds) => {
  const per = VIDEO_PRICES[model]?.[res]
  return per == null ? null : Math.round(per * seconds * 1e4) / 1e4
}

export function fail(message, hint, extra) {
  return { ok: false, message, hint: hint ?? null, ...extra }
}

/**
 * The key, in order: APIMODELS_API_KEY, then ~/.apimodels/credentials (written by
 * `login` or `save-key`, mode 0600), then ~/.apimodels/credentials.json (the
 * apimodels MCP server's login). There is deliberately no key argument anywhere:
 * arguments end up in transcripts and process listings.
 */
export async function resolveKey() {
  const fromEnv = process.env.APIMODELS_API_KEY?.trim()
  if (fromEnv) return fromEnv
  try {
    const saved = (await readFile(CRED_FILE, 'utf8')).trim()
    if (saved) return saved
  } catch { /* no saved key */ }
  try {
    const saved = JSON.parse(await readFile(MCP_CRED_FILE, 'utf8'))?.api_key
    if (typeof saved === 'string' && saved.trim()) return saved.trim()
  } catch { /* no MCP login either */ }
  return null
}

export const NO_KEY_HINT =
  'No apimodels.app API key found. In a terminal run:\n' +
  '  npx -y github:stimQQ/ai-video-director login   ← one browser click, nothing to type\n' +
  `or create a key at ${CONSOLE_URL} and set APIMODELS_API_KEY.`

export async function storeKey(key) {
  await mkdir(CRED_DIR, { recursive: true })
  await writeFile(CRED_FILE, key + '\n', { mode: 0o600 })
  await chmod(CRED_FILE, 0o600).catch(() => {})
}

export const looksLikeKey = (key) => /^sk_[A-Za-z0-9]{16,}$/.test(key || '')

/**
 * One-click browser authorization (RFC 8252 loopback): a random 127.0.0.1 port and
 * a state nonce; the user clicks Authorize on apimodels.app; the browser comes back
 * with a single-use code that is exchanged for a new key. The key never touches the
 * conversation, the shell history or the address bar.
 */
export async function login({ log = console.log, open = true } = {}) {
  const state = randomBytes(16).toString('base64url')
  let settle
  const done = new Promise((r) => { settle = r })
  const page = (title, text) =>
    `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;background:#111;color:#eee;display:grid;place-items:center;height:100vh"><div style="text-align:center"><h2>${title}</h2><p style="color:#999">${text}</p></div>`
  const server = createServer(async (req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1')
    if (u.pathname !== '/callback') { res.writeHead(404).end(); return }
    if (u.searchParams.get('state') !== state) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(page('State mismatch', 'This link belongs to another login attempt. Close this tab and run login again.'))
      return
    }
    try {
      const r = await fetch('https://apimodels.app/api/cli-auth/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: u.searchParams.get('code') ?? '' }),
        signal: AbortSignal.timeout(30000),
      })
      const data = await r.json().catch(() => null)
      const key = data?.data?.apiKey
      if (!r.ok || !key) throw new Error(data?.msg || `exchange failed (HTTP ${r.status})`)
      await storeKey(key)
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(page('✓ Connected', 'This machine is authorized. Close this tab and go back to your agent.'))
      settle({ ok: true, tail: key.slice(-4) })
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(page('Authorization failed', `${e.message}. Close this tab and run login again.`))
      settle({ ok: false, error: e.message })
    }
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const url = `https://apimodels.app/cli-auth?port=${server.address().port}&state=${state}`
  log(`Open this link, log in if asked, and click “Authorize”:\n\n  ${url}\n\nWaiting for the browser… (10 minutes; Ctrl-C to abort)`)
  if (open) openInBrowser(url)
  const timer = setTimeout(() => settle({ ok: false, error: 'timed out after 10 minutes' }), 10 * 60e3)
  const result = await done
  clearTimeout(timer)
  server.close()
  return result
}

export function openInBrowser(url) {
  const [cmd, args] = process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]]
  execFile(cmd, args, () => {})
}

/**
 * One API call. This API can answer HTTP 200 with a failure `code` in the body, so
 * the body decides, not the status line. `transient` marks failures worth retrying
 * while polling (network blips, gateway errors).
 */
export async function call(path, init, key) {
  let res
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(typeof init?.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(init?.timeoutMs ?? 60000),
    })
  } catch (e) {
    return fail(`network error talking to apimodels.app: ${e.message}`, null, { transient: true })
  }
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch {
    return fail(`unexpected non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`, null, { transient: res.status >= 500 })
  }
  const code = typeof body?.code === 'number' ? body.code : res.status
  if (code === 401) return fail('API key rejected (401).', `Create a new key at ${CONSOLE_URL}, or run login again.`)
  if (code === 402) return fail('Not enough balance (402).', 'Stop here. Do not top up on the user\'s behalf; cut what is already rendered and show it to them. Failed tasks are never charged.', { noBalance: true })
  if (code !== 200) return fail(`${body?.msg || 'request failed'} (code ${code})`, null, { transient: code >= 500 })
  return { ok: true, data: body.data }
}

/** Plain-language next step for a failed task. Failed tasks are never charged. */
export function explain(message, model) {
  const m = message || ''
  if (/real, identifiable person|real person|真人/i.test(m) && /^dreamina-/.test(model || '')) {
    return 'This video line refuses frames that look like a real person, and photoreal keyframes can trip it. Render this shot on seedance-2.0-mini instead. Not charged.'
  }
  if (/moderation|sensitive|审核|policy/i.test(m)) return 'Refused by content review. Change the prompt or the frames; retrying the same input will not help. Not charged.'
  if (/busy|overload|capacity|UPSTREAM_BUSY/i.test(m)) return 'The model is busy. Try the same shot again in a few minutes. Not charged.'
  if (/timeout|timed out/i.test(m)) return 'The render took too long upstream. Try again. Not charged.'
  return 'Not charged. Fix the cause before trying again: the same input usually fails the same way.'
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// Brisk at first, then back off: videos run about 2.5 min at p50 and 8 min at p90.
// DIRECTOR_POLL_MS exists for the offline tests, which talk to a local fake API.
const POLL_MS = process.env.DIRECTOR_POLL_MS ? [Number(process.env.DIRECTOR_POLL_MS)] : [3000, 3000, 5000, 5000, 5000, 8000, 8000, 10000, 15000]
const POLL_TAIL_MS = 15000
const MAX_WAIT_MS = { images: 10 * 60e3, video: 25 * 60e3 }

/**
 * Wait for a task. Returns { ok, urls } when done, { ok:false, pending:true } when
 * it is still running after `maxMs` (the caller keeps the task id and picks it up
 * later, so nothing is paid twice).
 */
export async function waitTask(kind, taskId, key, { maxMs = MAX_WAIT_MS[kind], pollMs = POLL_MS, onTick } = {}) {
  const started = Date.now()
  let blips = 0
  for (let i = 0; ; i++) {
    await sleep(pollMs[Math.min(i, pollMs.length - 1)] ?? POLL_TAIL_MS)
    const elapsed = Date.now() - started
    const r = await call(`/${kind}/generations?task_id=${encodeURIComponent(taskId)}`, { method: 'GET' }, key)
    if (!r.ok) {
      if (r.transient && ++blips <= 5) continue
      return { ...r, pending: true }
    }
    blips = 0
    const d = r.data || {}
    if (d.state === 'completed') {
      const urls = d.resultUrls || []
      if (!urls.length) return fail('the task finished but returned no file')
      return { ok: true, taskId, urls, seconds: Math.round(elapsed / 1000) }
    }
    if (d.state === 'failed') return fail(d.failMsg || d.failCode || 'generation failed')
    if (elapsed > maxMs) {
      return fail(`still running after ${Math.round(elapsed / 1000)} s`, 'The task id is saved. Call the same tool again later to pick it up; nothing is charged twice.', { pending: true, taskId })
    }
    onTick?.(Math.round(elapsed / 1000))
  }
}

/** Create a task and return its id. The caller persists it BEFORE waiting. */
export async function createTask(kind, body, key) {
  const r = await call(`/${kind}/generations`, { method: 'POST', body: JSON.stringify(body) }, key)
  if (!r.ok) return r
  const taskId = r.data?.taskId
  if (!taskId) return fail('the API accepted the request but returned no task id')
  return { ok: true, taskId }
}

/** What the API actually billed for a task. null while it is still settling. */
export async function billed(taskId, key, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const r = await call(`/records/${encodeURIComponent(taskId)}`, { method: 'GET' }, key)
    if (r.ok && r.data?.settled) return Number(r.data.credits)
    if (i < tries - 1) await sleep(3000)
  }
  return null
}

const MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', mp4: 'video/mp4', mov: 'video/quicktime',
}

/** Upload a local file; returns a public URL the generation APIs can fetch. */
export async function upload(file, key) {
  const buf = await readFile(file)
  const type = MIME[extname(file).slice(1).toLowerCase()] || 'application/octet-stream'
  const form = new FormData()
  form.append('file', new Blob([buf], { type }), basename(file))
  // No Content-Type header: fetch has to set the multipart boundary itself.
  const r = await call('/files', { method: 'POST', body: form, timeoutMs: 300000 }, key)
  if (!r.ok) return r
  if (!r.data?.publicUrl) return fail('upload succeeded but returned no URL')
  return { ok: true, url: r.data.publicUrl }
}

/** Download to `file` through a temp name, so a cut-off download never looks finished. */
export async function download(url, file) {
  const res = await fetch(url, { signal: AbortSignal.timeout(300000) })
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`)
  await mkdir(dirname(file), { recursive: true })
  const tmp = `${file}.part`
  await writeFile(tmp, Buffer.from(await res.arrayBuffer()))
  await rename(tmp, file)
}

export const extOf = (url, fallback) => {
  try { return extname(new URL(url).pathname) || fallback } catch { return fallback }
}
