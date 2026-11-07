// A stand-in for api.apimodels.app: uploads, image and video tasks, billing records.
// Media are real files made by ffmpeg, so the free ffmpeg steps run for real too.
//
//   node test/fakeApi.mjs   → prints the env vars to point the MCP server / console at it
import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const FAKE_KEY = 'sk_fakeapitestkey000000'

export function startFakeApi({ pendingPolls = 0 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'director-fake-api-'))
  const ff = (...a) => execFileSync('ffmpeg', ['-y', '-v', 'error', ...a])
  ff('-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=1', '-frames:v', '1', join(dir, 'frame.png'))
  ff('-f', 'lavfi', '-i', 'testsrc2=size=864x496:rate=24:duration=4', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=4', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', join(dir, 'clip.mp4'))
  const media = { images: 'frame.png', video: 'clip.mp4' }
  const state = { calls: [], bodies: [], polls: new Map(), pendingPolls, fail: null, n: 0 }

  const server = createServer((req, res) => {
    const u = new URL(req.url, 'http://x')
    const send = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)) }
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      state.calls.push(`${req.method} ${u.pathname}`)
      if (u.pathname.startsWith('/media/')) { res.writeHead(200); return res.end(readFileSync(join(dir, u.pathname.slice(7)))) }
      if (req.headers.authorization !== `Bearer ${FAKE_KEY}`) return send({ code: 401, msg: 'invalid key' })
      const base = `http://127.0.0.1:${server.address().port}`
      if (u.pathname === '/v1/files' && req.method === 'POST') return send({ code: 200, data: { publicUrl: `${base}/media/frame.png?u=${++state.n}` } })
      const kind = u.pathname.match(/^\/v1\/(images|video)\/generations$/)?.[1]
      if (kind && req.method === 'POST') {
        state.bodies.push({ kind, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) })
        return send({ code: 200, data: { taskId: `${kind}-${++state.n}` } })
      }
      if (kind) {
        const id = u.searchParams.get('task_id')
        const seen = (state.polls.get(id) || 0) + 1
        state.polls.set(id, seen)
        if (seen <= state.pendingPolls) return send({ code: 200, data: { state: 'processing' } })
        if (state.fail) return send({ code: 200, data: { state: 'failed', failMsg: state.fail } })
        return send({ code: 200, data: { state: 'completed', resultUrls: [`${base}/media/${media[kind]}`] } })
      }
      if (u.pathname.startsWith('/v1/records/')) {
        const id = decodeURIComponent(u.pathname.slice('/v1/records/'.length))
        return send({ code: 200, data: { settled: true, credits: id.startsWith('video') ? 0.09 : 0.02 } })
      }
      res.writeHead(404)
      res.end()
    })
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({
    url: `http://127.0.0.1:${server.address().port}/v1`, key: FAKE_KEY, state, close: () => new Promise((r) => server.close(r)),
  })))
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const api = await startFakeApi()
  console.log(`Fake API running. Use:\n  APIMODELS_BASE_URL=${api.url} APIMODELS_API_KEY=${api.key} DIRECTOR_POLL_MS=200`)
}
