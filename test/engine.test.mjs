// Offline tests: a fake API, real ffmpeg, the real console over HTTP.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { request } from 'node:http'
import { execFileSync } from 'node:child_process'
import { startFakeApi } from './fakeApi.mjs'

/** Mean brightness (0–255) of one region of an image or the first frame of a video. */
const meanGray = (file, crop) => execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `${crop},scale=1:1:flags=area,format=gray`, '-frames:v', '1', '-f', 'rawvideo', '-'])[0]

const api = await startFakeApi()
process.env.APIMODELS_BASE_URL = api.url
process.env.DIRECTOR_POLL_MS = '20'
const { createProject, openProject, applySection, gate, readApprovals } = await import('../engine/project.mjs')
const { generateImage, renderShot, deriveFrame, compareFrames, takeFrames, assemble, probe } = await import('../engine/media.mjs')
const { summary, recordReview } = await import('../engine/status.mjs')
const { startConsole } = await import('../console/server.mjs')
const KEY = api.key

let root
let con
// Every console a test opens is closed at the end even if the test failed half way —
// one left listening keeps the test process alive forever.
const opened = []
async function openConsole(dir) {
  const c = await startConsole({ root: dir })
  opened.push(c)
  return c
}
before(() => { root = mkdtempSync(join(tmpdir(), 'director-test-')) })
after(async () => {
  for (const c of opened) await c.close().catch(() => {})
  await api.close()
})

/** Talk to the console the way the page does (or deliberately not). */
function http(c, method, path, { body, token = c.token, host = `127.0.0.1:${c.port}`, type = 'application/json' } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: c.port, method, path, headers: { Host: host, ...(token ? { 'X-Director-Token': token } : {}), ...(body ? { 'Content-Type': type } : {}) } }, (res) => {
      let s = ''
      res.on('data', (d) => { s += d })
      res.on('end', () => { let j = null; try { j = JSON.parse(s) } catch { /* html */ } resolve({ status: res.statusCode, body: j, text: s }) })
    })
    req.on('error', reject)
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body))
    req.end()
  })
}
async function approve(c, key, extra = {}) {
  const v = await http(c, 'GET', '/api/p/_/view')
  const hash = v.body.summary.approvals[key].hash
  const r = await http(c, 'POST', '/api/p/_/decide', { body: { key, status: 'approved', hash, ...extra } })
  assert.equal(r.status, 200, `approve ${key}: ${r.text}`)
  return r
}

async function newProject(name) {
  const dir = join(root, name)
  const proj = await createProject(dir, { title: name, length_s: 10, aspect: '16:9' })
  return { dir, proj }
}

async function planned(name) {
  const { dir, proj } = await newProject(name)
  applySection(proj.data, 'story', { logline: 'A lantern finds its way home.', text: 'Short story text.', beats: ['one', 'two'] })
  applySection(proj.data, 'style', { preset: 'clean-flat-2d' })
  applySection(proj.data, 'storyboard', [
    { id: 's01', duration_s: 4, size: 'wide', angle: 'low', movement: 'push in', blocking: 'enters left', mover: 'lantern', transition: 'cut', description: 'A lantern drifts in.' },
    { id: 's02', duration_s: 5, size: 'close', angle: 'over shoulder', movement: 'static', blocking: 'none', mover: 'flame', transition: 'end', description: 'The flame steadies.' },
  ])
  await proj.save()
  return { dir, proj }
}

test('every style preset is complete in both languages and uses a priced video line', async () => {
  const { STYLES } = await import('../engine/styles.mjs')
  const { VIDEO_PRICES } = await import('../engine/api.mjs')
  assert.equal(new Set(STYLES.map((s) => s.id)).size, STYLES.length, 'preset ids are unique')
  for (const s of STYLES) {
    for (const f of ['name', 'summary', 'watch']) assert.ok(s[f]?.en && s[f]?.zh, `${s.id}: ${f} in en and zh`)
    assert.ok(s.image && s.video, `${s.id}: image and video lines`)
    assert.ok(s.palette.length >= 3 && s.palette.every((c) => /^#[0-9A-F]{6}$/i.test(c)), `${s.id}: hex palette`)
    assert.ok(VIDEO_PRICES[s.video_model], `${s.id}: ${s.video_model} has a price`)
  }
})

test('nothing paid can run before the user sets a budget and approves the steps', async () => {
  const { proj } = await newProject('gates')
  applySection(proj.data, 'story', { logline: 'x', text: 'y' })
  await proj.save()
  const g = await gate(proj, 'style', { cost: 0.025 })
  assert.equal(g.ok, false)
  const keys = g.blockers.map((b) => b.key)
  assert.ok(keys.includes('settings') && keys.includes('story') && keys.includes('budget'), JSON.stringify(g.blockers))
  const r = await generateImage(proj, KEY, { kind: 'style', prompt: 'a sample' })
  assert.equal(r.ok, false)
  assert.equal(r.blocked, true)
  assert.equal(api.state.bodies.length, 0, 'no paid request may reach the API')
})

test('console: approvals are bound to what the user saw; editing re-opens the gate', async () => {
  const { dir, proj } = await planned('flow')
  con = await openConsole(dir)
  // settings cannot be confirmed without a budget
  const v0 = await http(con, 'GET', '/api/p/_/view')
  const noBudget = await http(con, 'POST', '/api/p/_/decide', { body: { key: 'settings', status: 'approved', hash: v0.body.summary.approvals.settings.hash } })
  assert.equal(noBudget.status, 400)
  await approve(con, 'settings', { budget_usd: 0.5 })
  await approve(con, 'story')
  assert.equal((await readApprovals(dir)).budget_usd, 0.5)

  const before = api.state.bodies.length
  const r = await generateImage(proj, KEY, { kind: 'style', prompt: 'lantern sample' })
  assert.equal(r.ok, true, r.message)
  assert.equal(api.state.bodies.length, before + 1)
  assert.match(api.state.bodies.at(-1).body.prompt, /Modern flat 2D/, 'the project style line is prepended')
  assert.ok(existsSync(join(dir, 'style/sample-v1.png')))

  // the agent edits the story after approval → the story gate closes again
  applySection(proj.data, 'story', { logline: 'A lantern finds its way home.', text: 'Changed text.' })
  await proj.save()
  const s = await summary(proj)
  assert.equal(s.approvals.story.status, 'stale')
  const again = await generateImage(proj, KEY, { kind: 'style', prompt: 'another' })
  assert.equal(again.blocked, true)
  assert.match(again.message, /story: stale/)

  // a decision sent with an outdated hash is refused (409): the user must see the new version
  const stale = await http(con, 'POST', '/api/p/_/decide', { body: { key: 'story', status: 'approved', hash: 'deadbeefdeadbeef' } })
  assert.equal(stale.status, 409)
  // sending back needs a comment
  const v = await http(con, 'GET', '/api/p/_/view')
  const noComment = await http(con, 'POST', '/api/p/_/decide', { body: { key: 'story', status: 'rejected', hash: v.body.summary.approvals.story.hash } })
  assert.equal(noComment.status, 400)
  const sent = await http(con, 'POST', '/api/p/_/decide', { body: { key: 'story', status: 'rejected', comment: 'Make the ending warmer', hash: v.body.summary.approvals.story.hash } })
  assert.equal(sent.status, 200)
  const s2 = await summary(proj)
  assert.equal(s2.approvals.story.status, 'rejected')
  assert.match(s2.next, /Make the ending warmer/)
  await con.close(); con = null
})

test('console security: host, token, CSRF content type, paths', async () => {
  const { dir } = await planned('security')
  con = await openConsole(dir)
  assert.equal((await http(con, 'GET', '/api/p/_/view', { host: 'evil.example:80' })).status, 403, 'DNS rebinding host refused')
  assert.equal((await http(con, 'GET', '/api/p/_/view', { token: null })).status, 401, 'no token refused')
  assert.equal((await http(con, 'GET', '/api/p/_/view', { token: 'wrong' })).status, 401)
  assert.equal((await http(con, 'POST', '/api/p/_/decide', { body: 'key=story&status=approved', type: 'application/x-www-form-urlencoded' })).status, 415, 'form posts refused')
  assert.equal((await http(con, 'GET', `/api/p/_/file?path=${encodeURIComponent('../../etc/passwd')}`)).status, 404, 'no path traversal')
  // a media file just outside the project must not be reachable either
  writeFileSync(join(root, 'outside.png'), 'not really a png, the name is what matters')
  assert.equal((await http(con, 'GET', `/api/p/_/file?path=${encodeURIComponent('../outside.png')}`)).status, 404, 'no path traversal to media outside the project')
  assert.equal((await http(con, 'GET', `/api/p/_/file?path=director.json`)).status, 404, 'only media files are served')
  const page = await http(con, 'GET', '/', { token: null })
  assert.equal(page.status, 200)
  assert.match(page.text, new RegExp(con.token), 'the page carries the token')
  await con.close(); con = null
})

async function readyToRender(name, budget = 1) {
  const { dir, proj } = await planned(name)
  con = await openConsole(dir)
  await approve(con, 'settings', { budget_usd: budget })
  await approve(con, 'story')
  await generateImage(proj, KEY, { kind: 'style', prompt: 'sample' })
  await approve(con, 'style')
  await approve(con, 'storyboard')
  for (const s of ['s01', 's02']) {
    const last = await generateImage(proj, KEY, { kind: 'last', id: s, prompt: 'end of shot' })
    assert.equal(last.ok, true, last.message)
    const first = await generateImage(proj, KEY, { kind: 'first', id: s, prompt: 'start of shot', refs: [last.file] })
    assert.equal(first.ok, true, first.message)
    applySection(proj.data, 'shot', { id: s, video_prompt: `[Style] flat 2D\n[Camera] ${s}` })
    await proj.save()
  }
  return { dir, proj }
}

test('a render needs the shot approved, a current review pass, and room in the budget', async () => {
  const { proj } = await readyToRender('render')
  const videoPosts = () => api.state.bodies.filter((b) => b.kind === 'video').length
  const n0 = videoPosts()

  let r = await renderShot(proj, KEY, { shot: 's01' })
  assert.equal(r.blocked, true)
  assert.match(r.message, /frames:s01: awaiting/)
  assert.match(r.message, /review:s01: not reviewed/)

  await recordReview(proj, { shot: 's01', verdict: 'pass' })
  await approve(con, 'frames:s01')
  // the agent swaps the prompt after review + approval → both are for an older version now
  applySection(proj.data, 'shot', { id: 's01', video_prompt: '[Style] flat 2D\n[Camera] changed' })
  await proj.save()
  r = await renderShot(proj, KEY, { shot: 's01' })
  assert.equal(r.blocked, true)
  assert.match(r.message, /frames:s01: stale/)
  assert.match(r.message, /older version/)
  assert.equal(videoPosts(), n0, 'still nothing sent')

  await recordReview(proj, { shot: 's01', verdict: 'pass' })
  await approve(con, 'frames:s01')
  r = await renderShot(proj, KEY, { shot: 's01' })
  assert.equal(r.ok, true, r.message)
  assert.equal(videoPosts(), n0 + 1)
  const body = api.state.bodies.at(-1).body
  assert.ok(body.first_frame_url && body.last_frame_url, 'first and last frame are both sent')
  assert.equal(body.duration, 4)
  assert.equal(body.model, 'dreamina-seedance-2-0-mini', 'flat 2D preset picks the affordable stylised line')
  assert.ok(existsSync(join(proj.dir, 'clips/s01-take1-v1.mp4')))

  // a second call does not pay again unless asked
  r = await renderShot(proj, KEY, { shot: 's01' })
  assert.equal(r.already, true)
  assert.equal(videoPosts(), n0 + 1)
  await con.close(); con = null
})

test('budget: a render that would go over the user\'s budget is refused', async () => {
  // 3 images (0.02 billed each by the fake) + 2 frames per shot… then a 5 s shot at 0.0225/s
  const { proj } = await readyToRender('budget', 0.15)
  await recordReview(proj, { shot: 's02', verdict: 'pass' })
  await approve(con, 'frames:s02')
  const r = await renderShot(proj, KEY, { shot: 's02' })
  assert.equal(r.blocked, true)
  assert.match(r.message, /over budget/)
  await con.close(); con = null
})

test('a task that outlives the call is resumed, never paid twice', async () => {
  const { proj } = await readyToRender('resume')
  await recordReview(proj, { shot: 's01', verdict: 'pass' })
  await approve(con, 'frames:s01')
  api.state.pendingPolls = 1000
  const posts = () => api.state.bodies.filter((b) => b.kind === 'video').length
  const n0 = posts()
  let r = await renderShot(proj, KEY, { shot: 's01', waitS: 0.3 })
  assert.equal(r.pending, true)
  assert.equal(posts(), n0 + 1)
  // reopen from disk, as a new MCP process would
  const again = await openProject(proj.dir)
  assert.equal(again.data.shots[0].takes[0].state, 'submitted')
  api.state.pendingPolls = 0
  r = await renderShot(again, KEY, { shot: 's01', waitS: 5 })
  assert.equal(r.ok, true, r.message)
  assert.equal(posts(), n0 + 1, 'resumed the same task')
  await con.close(); con = null
})

test('versions are never overwritten; free ffmpeg tools work', async () => {
  const { proj } = await readyToRender('tools')
  const before = proj.data.shots[0].frames.last.length
  const original = proj.data.shots[0].selected.last
  const originalBytes = readFileSync(join(proj.dir, original))
  const d = await deriveFrame(proj, { shot: 's01', from: 'first', to: 'last', zoom: 1.2 })
  assert.equal(d.ok, true)
  assert.notEqual(d.file, original, 'a derived frame is a new version')
  assert.ok(readFileSync(join(proj.dir, original)).equals(originalBytes), 'the old version is untouched')
  assert.equal(proj.data.shots[0].frames.last.length, before + 1)
  assert.ok(existsSync(join(proj.dir, 'frames/s01/last-v1.png')) && existsSync(join(proj.dir, d.file)))
  assert.equal(proj.data.shots[0].selected.last, d.file)
  const c = await compareFrames(proj, { shot: 's01' })
  assert.equal(c.sameSize, true)
  const info = await probe(join(proj.dir, c.file))
  assert.equal(info.width, 1920, 'three panels of 640 wide')
  // any two versions of the same frame, e.g. before and after a local fix
  const v = await compareFrames(proj, { a: original, b: d.file })
  assert.equal(v.left, original)
  assert.equal(v.right, d.file)
  assert.ok(existsSync(join(proj.dir, v.file)) && v.file.startsWith('review/compare/'))
  await assert.rejects(compareFrames(proj, { a: 'director.json', b: d.file }), /images only/)
  await con.close(); con = null
})

test('take frames and the final cut (1080p, all shots)', async () => {
  const { proj } = await readyToRender('cut', 2)
  for (const s of ['s01', 's02']) {
    await recordReview(proj, { shot: s, verdict: 'pass' })
    await approve(con, `frames:${s}`)
    const r = await renderShot(proj, KEY, { shot: s })
    assert.equal(r.ok, true, r.message)
  }
  const f = await takeFrames(proj, { shot: 's01' })
  assert.ok(existsSync(join(proj.dir, f.sheet)) && existsSync(join(proj.dir, f.start)) && existsSync(join(proj.dir, f.end)))
  const out = await assemble(proj, { trims: { s02: { start: 0.5 } } })
  assert.equal(out.ok, true)
  const info = await probe(join(proj.dir, out.file))
  assert.equal(info.width, 1920)
  assert.equal(info.height, 1080)
  assert.ok(Math.abs(info.duration - 7.5) < 0.4, `duration ${info.duration}`)
  assert.equal(info.colorSpace, 'bt709')
  const out2 = await assemble(proj, { upscale: false })
  assert.notEqual(out2.file, out.file, 'a second cut is a new version')
  assert.ok(existsSync(join(proj.dir, out.file)))
  const s = await summary(proj)
  assert.match(s.next, /first-time viewer/)
  await con.close(); con = null
})

test('cost of a failed task is not counted against the budget', async () => {
  const { proj } = await readyToRender('failed')
  await recordReview(proj, { shot: 's01', verdict: 'pass' })
  await approve(con, 'frames:s01')
  api.state.fail = 'moderation: sensitive content'
  const r = await renderShot(proj, KEY, { shot: 's01' })
  api.state.fail = null
  assert.equal(r.ok, false)
  assert.match(r.hint, /content review/)
  const e = proj.data.spend.find((x) => x.what === 'video s01 take 1')
  assert.equal(e.cost, 0)
  await con.close(); con = null
})

test('the agent cannot write approvals by saving a section', async () => {
  const { dir, proj } = await planned('noforge')
  const problems = applySection(proj.data, 'approvals', { story: 'approved' })
  assert.ok(problems.length)
  writeFileSync(join(dir, 'note.txt'), 'x')
  assert.equal(existsSync(join(dir, 'approvals.json')), false)
  assert.equal(JSON.parse(readFileSync(join(dir, 'director.json'), 'utf8')).approvals, undefined)
})

test('a JPEG and a PNG of the same picture compare as (near) black, not green', async () => {
  const { proj } = await readyToRender('formats')
  const png = proj.data.shots[0].selected.last
  const jpgSrc = join(root, 'same-picture.jpg')
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', join(proj.dir, png), '-q:v', '2', jpgSrc])
  const imported = await (await import('../engine/media.mjs')).importImage(proj, { kind: 'first', id: 's02', path: jpgSrc })
  const c = await compareFrames(proj, { a: png, b: imported.file })
  const diff = meanGray(join(proj.dir, c.file), 'crop=iw/3:ih:2*iw/3:0')
  assert.ok(diff < 25, `difference panel should be near black, mean was ${diff}`)
  await con.close(); con = null
})

test('clips a few pixels off the aspect ratio are filled, not letterboxed', async () => {
  const { proj } = await readyToRender('nobars')
  await recordReview(proj, { shot: 's01', verdict: 'pass' })
  await approve(con, 'frames:s01')
  const r = await renderShot(proj, KEY, { shot: 's01' })
  assert.equal(r.ok, true, r.message)
  const src = await probe(join(proj.dir, r.file))
  assert.equal(`${src.width}x${src.height}`, '864x496', 'the fake returns what Seedance really returns')
  const out = await assemble(proj, {})
  const final = join(proj.dir, out.file)
  const left = meanGray(final, 'crop=6:ih:0:0')
  const right = meanGray(final, 'crop=6:ih:iw-6:0')
  assert.ok(left > 20 && right > 20, `no black bars expected, edge brightness ${left} / ${right}`)
  await con.close(); con = null
})
