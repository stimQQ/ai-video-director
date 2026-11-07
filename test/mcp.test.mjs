// The MCP server as a client sees it: a child process speaking JSON-RPC on stdio.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startFakeApi } from './fakeApi.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const api = await startFakeApi()
const cwd = mkdtempSync(join(tmpdir(), 'director-mcp-'))
const child = spawn(process.execPath, [join(here, '..', 'mcp', 'server.mjs')], {
  cwd, stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, APIMODELS_BASE_URL: api.url, APIMODELS_API_KEY: api.key, DIRECTOR_POLL_MS: '20', DIRECTOR_WAIT_S: '5' },
})
const pending = new Map()
let buf = ''
child.stdout.setEncoding('utf8')
child.stdout.on('data', (c) => {
  buf += c
  let i
  while ((i = buf.indexOf('\n')) >= 0) {
    const msg = JSON.parse(buf.slice(0, i))
    buf = buf.slice(i + 1)
    pending.get(msg.id)?.(msg)
    pending.delete(msg.id)
  }
})
let nextId = 1
const rpc = (method, params) => new Promise((resolve) => {
  const id = nextId++
  pending.set(id, resolve)
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
})
const tool = async (name, args) => {
  const r = await rpc('tools/call', { name, arguments: args })
  const text = r.result?.content?.find((c) => c.type === 'text')?.text
  let data = null
  try { data = JSON.parse(text) } catch { /* plain text */ }
  return { isError: !!r.result?.isError, text, data, raw: r }
}
after(async () => { child.stdin.end(); await new Promise((r) => child.once('exit', r)); await api.close() })

test('initialize and list tools', async () => {
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } })
  assert.equal(init.result.protocolVersion, '2025-06-18')
  assert.equal(init.result.serverInfo.name, 'video-director')
  assert.match(init.result.instructions, /approve/i)
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
  const list = await rpc('tools/list', {})
  const names = list.result.tools.map((t) => t.name)
  for (const n of ['director_new', 'director_status', 'director_save', 'director_image', 'director_render', 'director_assemble', 'director_wait']) assert.ok(names.includes(n), n)
  for (const t of list.result.tools) assert.equal(t.inputSchema.type, 'object', t.name)
  const unknownProto = await rpc('initialize', { protocolVersion: '1999-01-01' })
  assert.equal(unknownProto.result.protocolVersion, '2025-06-18', 'falls back to a supported version')
})

test('a project from start to a blocked paid call', async () => {
  const created = await tool('director_new', { title: 'Paper Boat', length_s: 20, aspect: '9:16', open: false })
  assert.equal(created.isError, false, created.text)
  assert.ok(existsSync(join(created.data.project, 'director.json')))
  assert.match(created.data.console, /^http:\/\/127\.0\.0\.1:\d+\/$/)
  const project = created.data.project

  const bad = await tool('director_save', { project, section: 'story', data: { text: 'no logline' } })
  assert.equal(bad.isError, true)
  assert.match(bad.text, /logline/)
  const ok = await tool('director_save', { project, section: 'story', data: { logline: 'A paper boat outlives the storm.', text: 'Story.' } })
  assert.equal(ok.isError, false)

  const blocked = await tool('director_image', { project, kind: 'style', prompt: 'sample' })
  assert.equal(blocked.isError, false, 'a closed gate is information, not a crash')
  assert.equal(blocked.data.blocked, true)
  assert.match(blocked.data.message, /budget/)
  assert.equal(api.state.bodies.length, 0, 'nothing reached the API')

  const st = await tool('director_status', { project })
  assert.equal(st.data.settings.aspect, '9:16')
  assert.match(st.data.next, /budget/)

  const w = await tool('director_wait', { project, timeout_s: 1 })
  assert.deepEqual(w.data.decisions, [])

  const styles = await tool('director_styles', { lang: 'zh' })
  assert.ok(styles.data.styles.length >= 8)

  const unknown = await rpc('tools/call', { name: 'nope', arguments: {} })
  assert.ok(unknown.error)
})

test('errors come back as tool errors, not a dead server', async () => {
  const r = await tool('director_status', { project: join(cwd, 'does-not-exist') })
  assert.equal(r.isError, true)
  assert.match(r.text, /no project/)
  const ping = await rpc('ping', {})
  assert.deepEqual(ping.result, {})
})
