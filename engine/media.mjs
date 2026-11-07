/**
 * Everything that makes or touches media: keyframes and sheets (image API), shots
 * (Seedance first + last frame), and the free ffmpeg work around them — deriving a
 * push-in frame, comparing two keyframes, contact sheets of a take, the final cut.
 *
 * Paid calls go through gate() first. Task ids are written to director.json the
 * moment the API returns them, so a crash, a timeout or a closed laptop never
 * means paying for the same render twice: the next call picks the task up again.
 */

import { copyFile, mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import { execFile } from 'node:child_process'
import {
  createTask, waitTask, billed, upload, download, explain, extOf, NO_KEY_HINT,
} from './api.mjs'
import {
  gate, describeBlockers, nextVersion, inProject, fileHash, readApprovals, estimateImage, estimateShot,
  effectiveVideoModel, effectiveResolution, shotSeconds, committed, currentHash, isImage,
} from './project.mjs'

const UPLOAD_REUSE_DAYS = 20 // uploads live 30 days on the API side; refresh well before that

// Working sizes. Keyframes are normalized to exactly this before a render so the
// first and last frame always share one size and one aspect ratio.
export const FRAME_SIZE = {
  '16:9': [1280, 720], '9:16': [720, 1280], '1:1': [960, 960],
  '4:3': [1024, 768], '3:4': [768, 1024], '21:9': [1344, 576],
}
const DELIVERY_SIZE = { // 1080p delivery
  '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080],
  '4:3': [1440, 1080], '3:4': [1080, 1440], '21:9': [2520, 1080],
}

export function run(cmd, args, opts = {}) {
  return new Promise((ok, no) => {
    execFile(cmd, args, { maxBuffer: 64 << 20, ...opts }, (err, stdout, stderr) => {
      if (err) no(new Error(`${cmd} failed: ${(stderr || err.message).trim().split('\n').slice(-4).join('\n')}`))
      else ok(stdout)
    })
  })
}

export async function hasFfmpeg() {
  try { await run('ffmpeg', ['-version']); await run('ffprobe', ['-version']); return true } catch { return false }
}
const FFMPEG_HINT = 'ffmpeg not found. Install it (macOS: brew install ffmpeg · Ubuntu: sudo apt install ffmpeg · Windows: winget install ffmpeg).'
async function needFfmpeg() {
  if (!(await hasFfmpeg())) throw new Error(FFMPEG_HINT)
}

export async function probe(file) {
  const j = JSON.parse(await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,color_space', '-of', 'json', file]))
  const streams = j.streams || []
  const v = streams.find((x) => x.codec_type === 'video')
  return { duration: Number(j.format?.duration) || 0, width: v?.width, height: v?.height, colorSpace: v?.color_space ?? null, hasAudio: streams.some((x) => x.codec_type === 'audio') }
}

async function uploadCached(proj, rel, key) {
  const p = proj.data
  const full = inProject(proj.dir, rel)
  const h = await fileHash(full)
  p.uploads ??= {}
  const hit = p.uploads[h]
  if (hit && Date.now() - Date.parse(hit.at) < UPLOAD_REUSE_DAYS * 864e5) return { ok: true, url: hit.url }
  const r = await upload(full, key)
  if (r.ok) { p.uploads[h] = { url: r.url, at: new Date().toISOString() }; await proj.save() }
  return r
}

const short = (n) => (n == null ? '?' : `$${n.toFixed(4)}`)

// ─── images ─────────────────────────────────────────────────────────────────

const IMAGE_KINDS = { style: 'style', cast: 'cast', first: 'frame', last: 'frame' }

function slotOf(kind, id) { return `${kind}:${id || ''}` }

function targetFor(p, kind, id) {
  if (kind === 'style') return { sub: 'style', base: 'sample' }
  if (kind === 'cast') {
    if (!p.cast.find((c) => c.id === id)) throw new Error(`no cast member "${id}" — save the cast list first`)
    return { sub: 'cast', base: id }
  }
  if (!p.shots.find((s) => s.id === id)) throw new Error(`no shot "${id}" in the storyboard`)
  return { sub: `frames/${id}`, base: kind }
}

/** Record a finished image in the plan and select it (selection changes the approval hash). */
function attachImage(p, kind, id, entry) {
  if (kind === 'style') {
    p.style.samples.push(entry)
    p.style.selected = [...(p.style.selected || []), entry.file].slice(-4)
  } else if (kind === 'cast') {
    const c = p.cast.find((x) => x.id === id)
    c.sheets = [...(c.sheets || []), entry]
    c.selected = entry.file
  } else {
    const s = p.shots.find((x) => x.id === id)
    s.frames ??= { first: [], last: [] }
    s.frames[kind] = [...(s.frames[kind] || []), entry]
    s.selected = { ...(s.selected || {}), [kind]: entry.file }
  }
}

/**
 * Generate one image: a style sample, a character / prop sheet, or a shot's first or
 * last frame. `refs` are project-relative image paths sent as references (edit mode),
 * e.g. the last frame when drawing the first, or a character sheet.
 */
export async function generateImage(proj, key, { kind, id, prompt, refs = [], model, resolution, aspect, waitS = 240 }) {
  if (!IMAGE_KINDS[kind]) throw new Error('kind must be style, cast, first or last')
  if (!key) return { ok: false, message: NO_KEY_HINT }
  const p = proj.data
  const t = targetFor(p, kind, id)
  const slot = slotOf(kind, id)
  model ||= p.settings.image_model
  resolution ||= p.settings.image_resolution
  let task = p.tasks[slot]

  if (!task) {
    if (!prompt) throw new Error('prompt is required')
    const cost = estimateImage(p, model, resolution)
    const g = await gate(proj, IMAGE_KINDS[kind], { cost })
    if (!g.ok) return { ok: false, blocked: true, message: `Not allowed yet:\n${describeBlockers(g.blockers)}`, blockers: g.blockers }
    const urls = []
    for (const rel of refs) {
      if (!isImage(rel)) throw new Error(`reference must be an image in the project: ${rel}`)
      const u = await uploadCached(proj, rel, key)
      if (!u.ok) return u
      urls.push(u.url)
    }
    const styleLine = p.style.image ? `${p.style.image}\n\n` : ''
    const sent = `${styleLine}${prompt}`
    const body = {
      model, prompt: sent, resolution,
      aspect_ratio: aspect || (kind === 'cast' ? '16:9' : p.settings.aspect),
      ...(urls.length ? { image_urls: urls } : {}),
    }
    const created = await createTask('images', body, key)
    if (!created.ok) return { ...created, hint: created.hint || explain(created.message, model) }
    task = p.tasks[slot] = { task_id: created.taskId, kind, id: id || null, model, resolution, prompt: sent, refs, estimate: cost, at: new Date().toISOString() }
    p.spend.push({ at: task.at, what: `image ${slot}`, task_id: created.taskId, estimate: cost, cost: null })
    await proj.save()
  }

  const r = await waitTask('images', task.task_id, key, { maxMs: waitS * 1000 })
  if (!r.ok) {
    if (r.pending) return { ok: false, pending: true, message: `${slot} is still generating (task ${task.task_id}). Call the same tool again to keep waiting; it will not be charged twice.` }
    delete p.tasks[slot]
    const e = p.spend.find((x) => x.task_id === task.task_id)
    if (e) e.cost = 0 // failed tasks are not charged
    await proj.save()
    return { ok: false, message: r.message, hint: explain(r.message, task.model) }
  }
  const { rel, version } = await nextVersion(proj.dir, t.sub, t.base, extOf(r.urls[0], '.png'))
  await download(r.urls[0], inProject(proj.dir, rel))
  const cost = await billed(task.task_id, key)
  const e = p.spend.find((x) => x.task_id === task.task_id)
  if (e) e.cost = cost
  attachImage(p, kind, id, { file: rel, version, cost, model: task.model, prompt: task.prompt, refs: task.refs, task_id: task.task_id, at: new Date().toISOString() })
  delete p.tasks[slot]
  await proj.save()
  return { ok: true, file: rel, version, cost, message: `saved ${rel} (${short(cost)}). It is now the selected ${kind === 'style' ? 'style sample' : kind === 'cast' ? `sheet for ${id}` : `${kind} frame of ${id}`}. Look at it before asking the user.` }
}

/** Bring in an image made elsewhere (e.g. Codex's own image tool, or the user's file). Free. */
export async function importImage(proj, { kind, id, path }) {
  if (!IMAGE_KINDS[kind]) throw new Error('kind must be style, cast, first or last')
  if (!isImage(path)) throw new Error('only .png, .jpg, .jpeg or .webp images can be imported')
  if (!existsSync(path)) throw new Error(`file not found: ${path}`)
  const p = proj.data
  const t = targetFor(p, kind, id)
  const { rel, version } = await nextVersion(proj.dir, t.sub, t.base, extname(path).toLowerCase())
  await copyFile(path, inProject(proj.dir, rel))
  attachImage(p, kind, id, { file: rel, version, cost: 0, imported_from: path, at: new Date().toISOString() })
  await proj.save()
  return { ok: true, file: rel, version }
}

/**
 * Make one keyframe from the other by cropping in (push-in) or, with zoom < 1 on the
 * LAST frame, prepare a pull-out. Same camera, same everything, only the framing
 * changes, so the shot moves the way it was planned. Free (ffmpeg).
 */
export async function deriveFrame(proj, { shot, from = 'first', to = 'last', zoom = 1.15, cx = 0.5, cy = 0.5 }) {
  await needFfmpeg()
  const p = proj.data
  const s = p.shots.find((x) => x.id === shot)
  if (!s) throw new Error(`no shot "${shot}"`)
  const src = s.selected?.[from]
  if (!src) throw new Error(`shot ${shot} has no ${from} frame yet`)
  if (!(zoom > 1 && zoom <= 3)) throw new Error('zoom must be between 1 and 3 (crop in from the source frame)')
  const full = inProject(proj.dir, src)
  const { width: W, height: H } = await probe(full)
  const w = Math.round(W / zoom) & ~1
  const h = Math.round(H / zoom) & ~1
  const x = Math.round(Math.min(Math.max(cx * W - w / 2, 0), W - w))
  const y = Math.round(Math.min(Math.max(cy * H - h / 2, 0), H - h))
  const { rel, version } = await nextVersion(proj.dir, `frames/${shot}`, to, '.png')
  await run('ffmpeg', ['-y', '-v', 'error', '-i', full, '-vf', `crop=${w}:${h}:${x}:${y},scale=${W}:${H}:flags=lanczos`, '-frames:v', '1', inProject(proj.dir, rel)])
  attachImage(p, to, shot, { file: rel, version, cost: 0, derived: { from: src, zoom, cx, cy }, at: new Date().toISOString() })
  await proj.save()
  return { ok: true, file: rel, version }
}

/**
 * First | last | difference, side by side, for the reviewer: everything that should
 * not change between the two frames must be black in the difference panel, or the
 * video will morph it (a wall slowly changing colour, a cup slowly growing).
 */
export async function compareFrames(proj, { shot, a: relA, b: relB }) {
  await needFfmpeg()
  const p = proj.data
  let left = relA
  let right = relB
  let folder = 'review/compare'
  if (!(left && right)) {
    // Default: the shot's selected first vs last. Pass a and b to compare any two
    // project images instead, e.g. two versions of the same frame after a local fix.
    const s = p.shots.find((x) => x.id === shot)
    if (!s?.selected?.first || !s?.selected?.last) throw new Error(`shot ${shot} needs both a first and a last frame (or pass a and b)`)
    left = s.selected.first
    right = s.selected.last
    folder = `review/${shot}`
  }
  if (!isImage(left) || !isImage(right)) throw new Error('compare works on project images only')
  const [W, H] = FRAME_SIZE[p.settings.aspect] ?? [1280, 720]
  const w = Math.round(W / 2) & ~1
  const h = Math.round(H / 2) & ~1
  const { rel } = await nextVersion(proj.dir, folder, 'compare', '.png')
  // Same pixel format on both sides before subtracting: a JPEG keyframe is YUV and a
  // PNG is RGB, and blending the two raw gives a solid green panel instead of a difference.
  const fit = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,format=gbrp`
  await run('ffmpeg', ['-y', '-v', 'error',
    '-i', inProject(proj.dir, left), '-i', inProject(proj.dir, right),
    '-filter_complex', `[0:v]${fit},split[a][a2];[1:v]${fit},split[b][b2];[a2][b2]blend=all_mode=difference,eq=contrast=3[d];[a][b][d]hstack=inputs=3`,
    '-frames:v', '1', inProject(proj.dir, rel)])
  const [ia, ib] = await Promise.all([probe(inProject(proj.dir, left)), probe(inProject(proj.dir, right))])
  const sameSize = ia.width === ib.width && ia.height === ib.height
  return { ok: true, file: rel, left, right, left_size: `${ia.width}×${ia.height}`, right_size: `${ib.width}×${ib.height}`, sameSize, note: sameSize ? `Panels: ${left} | ${right} | difference (amplified). Anything that should not change must be black.` : 'The two images differ in size; keyframes are cropped to the project aspect before rendering — check that nothing important is cut off.' }
}

// ─── shots ──────────────────────────────────────────────────────────────────

async function normalizeFrame(proj, rel, aspect, name) {
  const [W, H] = FRAME_SIZE[aspect] ?? [1280, 720]
  const out = join(proj.dir, 'build', 'frames', name)
  await mkdir(join(proj.dir, 'build', 'frames'), { recursive: true })
  await run('ffmpeg', ['-y', '-v', 'error', '-i', inProject(proj.dir, rel),
    '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H}`, '-frames:v', '1', out])
  return out.slice(proj.dir.length + 1)
}

/**
 * Render (or keep waiting for) one take of a shot from its selected first and last
 * frames and its video prompt. A new call while a take is still rendering resumes
 * it; `newTake: true` starts another paid take (earlier takes are always kept).
 */
export async function renderShot(proj, key, { shot, newTake = false, waitS = 240 }) {
  if (!key) return { ok: false, message: NO_KEY_HINT }
  await needFfmpeg()
  const p = proj.data
  const s = p.shots.find((x) => x.id === shot)
  if (!s) throw new Error(`no shot "${shot}"`)
  s.takes ??= []
  let take = s.takes.find((t) => t.state === 'submitted')

  if (!take) {
    const done = s.takes.filter((t) => t.state === 'done').length
    if (done && !newTake) return { ok: true, already: true, message: `${shot} already has ${done} finished take(s). Pass new_take: true to pay for another one.`, takes: s.takes }
    const cost = estimateShot(p, s)
    const g = await gate(proj, 'render', { shotId: shot, cost })
    if (!g.ok) return { ok: false, blocked: true, message: `Not allowed yet:\n${describeBlockers(g.blockers)}`, blockers: g.blockers }
    const model = effectiveVideoModel(p, s)
    const resolution = effectiveResolution(p, s)
    const seconds = shotSeconds(s)
    const hash = await currentHash(proj, `frames:${shot}`)
    const first = await uploadCached(proj, await normalizeFrame(proj, s.selected.first, p.settings.aspect, `${shot}-first.png`), key)
    if (!first.ok) return first
    const last = await uploadCached(proj, await normalizeFrame(proj, s.selected.last, p.settings.aspect, `${shot}-last.png`), key)
    if (!last.ok) return last
    const body = {
      model, prompt: s.video_prompt, resolution, aspect_ratio: p.settings.aspect, duration: seconds,
      first_frame_url: first.url, last_frame_url: last.url, generate_audio: true,
    }
    const created = await createTask('video', body, key)
    if (!created.ok) return { ...created, hint: created.hint || explain(created.message, model) }
    const n = Math.max(0, ...s.takes.map((t) => t.take)) + 1
    take = { take: n, state: 'submitted', task_id: created.taskId, model, resolution, seconds, hash, estimate: cost, at: new Date().toISOString() }
    s.takes.push(take)
    p.spend.push({ at: take.at, what: `video ${shot} take ${n}`, task_id: created.taskId, estimate: cost, cost: null })
    await proj.save()
  }

  const r = await waitTask('video', take.task_id, key, { maxMs: waitS * 1000 })
  if (!r.ok) {
    if (r.pending) return { ok: false, pending: true, message: `${shot} take ${take.take} is still rendering (task ${take.task_id}; videos usually take 2–8 minutes). Call director_render again for ${shot} to keep waiting — it resumes, it does not pay again.` }
    take.state = 'failed'
    take.error = r.message
    const e = p.spend.find((x) => x.task_id === take.task_id)
    if (e) e.cost = 0
    await proj.save()
    return { ok: false, message: r.message, hint: explain(r.message, take.model) }
  }
  const { rel } = await nextVersion(proj.dir, 'clips', `${shot}-take${take.take}`, extOf(r.urls[0], '.mp4'))
  await download(r.urls[0], inProject(proj.dir, rel))
  take.file = rel
  take.state = 'done'
  take.cost = await billed(take.task_id, key)
  const e = p.spend.find((x) => x.task_id === take.task_id)
  if (e) e.cost = take.cost
  await proj.save()
  return { ok: true, file: rel, take: take.take, cost: take.cost, message: `saved ${rel} (${short(take.cost)}). Make a contact sheet (director_frames) and look at it before showing the user. You cannot see motion or hear sound — say so.` }
}

/**
 * A contact sheet of a take plus its very first and very last frame, so a model that
 * only sees still images can check a clip: jumps, morphing, extra people, the end
 * matching the planned last frame. Free (ffmpeg).
 */
export async function takeFrames(proj, { shot, take, count = 8 }) {
  await needFfmpeg()
  const s = proj.data.shots.find((x) => x.id === shot)
  const t = (s?.takes || []).find((x) => x.take === Number(take)) ?? (s?.takes || []).filter((x) => x.state === 'done').at(-1)
  if (!t?.file) throw new Error(`no finished take ${take ?? ''} for shot ${shot}`)
  const clip = inProject(proj.dir, t.file)
  const { duration } = await probe(clip)
  const cols = 4
  const rows = Math.ceil(count / cols)
  const sheet = await nextVersion(proj.dir, `review/${shot}`, `take${t.take}-sheet`, '.jpg')
  await run('ffmpeg', ['-y', '-v', 'error', '-i', clip, '-vf', `fps=${(count / Math.max(duration, 0.1)).toFixed(4)},scale=480:-2,tile=${cols}x${rows}`, '-frames:v', '1', '-q:v', '3', inProject(proj.dir, sheet.rel)])
  const start = `review/${shot}/take${t.take}-start.png`
  const end = `review/${shot}/take${t.take}-end.png`
  await run('ffmpeg', ['-y', '-v', 'error', '-i', clip, '-frames:v', '1', inProject(proj.dir, start)])
  await run('ffmpeg', ['-y', '-v', 'error', '-sseof', '-0.1', '-i', clip, '-frames:v', '1', '-update', '1', inProject(proj.dir, end)])
  return { ok: true, take: t.take, seconds: Math.round(duration * 10) / 10, sheet: sheet.rel, start, end, note: 'Sheet reads left to right, top to bottom. Compare start/end with the planned first/last frames.' }
}

// ─── final cut ──────────────────────────────────────────────────────────────

const slug = (t) => (t || 'film').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'film'

/**
 * Cut the chosen takes together. Per shot: optional trim; every clip is normalized to
 * one size, 24 fps and stereo 48 kHz; untagged sources are read as BT.601 and the
 * delivery is converted to and tagged BT.709. Optional 1080p upscale (lanczos plus a
 * light sharpen) and an optional music bed. Written as a new version; never overwrites.
 */
export async function assemble(proj, { takes = {}, trims = {}, upscale = true, audio = 'clips', music = null, musicVolume = 0.5 } = {}) {
  await needFfmpeg()
  const p = proj.data
  const approvals = await readApprovals(proj.dir)
  const chosen = []
  const missing = []
  for (const s of p.shots) {
    const want = takes[s.id] ?? approvals.take_pick[s.id]
    const done = (s.takes || []).filter((t) => t.state === 'done' && t.file)
    const t = want != null ? done.find((x) => x.take === Number(want)) : done.at(-1)
    if (t) chosen.push({ s, t }); else missing.push(s.id)
  }
  if (!chosen.length) throw new Error('no finished takes to cut yet')
  const [W, H] = FRAME_SIZE[p.settings.aspect] ?? [1280, 720]
  const build = join(proj.dir, 'build', 'cut')
  await mkdir(build, { recursive: true })
  const parts = []
  for (const { s, t } of chosen) {
    const src = inProject(proj.dir, t.file)
    const info = await probe(src)
    const tr = trims[s.id] || {}
    const start = Math.max(0, Number(tr.start) || 0)
    const end = Math.min(info.duration, Number(tr.end) || info.duration)
    const len = Math.max(0.2, end - start)
    const inMatrix = info.colorSpace && /709/.test(info.colorSpace) ? 'bt709' : 'bt601'
    // Seedance returns sizes close to, not exactly, the asked ratio (864×496 for 16:9).
    // Fill and trim the sliver when it is that close; letterbox only a real mismatch.
    const near = info.width && info.height && Math.abs((info.width / info.height) / (W / H) - 1) < 0.06
    const fitClip = near
      ? `scale=${W}:${H}:force_original_aspect_ratio=increase:in_color_matrix=${inMatrix}:out_color_matrix=bt709,crop=${W}:${H}`
      : `scale=${W}:${H}:force_original_aspect_ratio=decrease:in_color_matrix=${inMatrix}:out_color_matrix=bt709,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2`
    const args = ['-y', '-v', 'error', '-ss', String(start), '-t', String(len), '-i', src]
    let a = '0:a'
    if (!info.hasAudio || audio === 'mute') { args.push('-f', 'lavfi', '-t', String(len), '-i', 'anullsrc=r=48000:cl=stereo'); a = '1:a' }
    const out = join(build, `${s.id}.mp4`)
    args.push('-filter_complex',
      `[0:v]${fitClip},setsar=1,fps=24,format=yuv420p[v];[${a}]aresample=48000,aformat=channel_layouts=stereo[a]`,
      '-map', '[v]', '-map', '[a]', '-t', String(len), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-c:a', 'aac', '-b:a', '192k', out)
    await run('ffmpeg', args)
    parts.push({ shot: s.id, take: t.take, file: out, seconds: Math.round(len * 100) / 100 })
  }
  await writeFile(join(build, 'concat.txt'), parts.map((x) => `file '${x.shot}.mp4'`).join('\n') + '\n')
  await run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', 'joined.mp4'], { cwd: build })

  const { rel, version } = await nextVersion(proj.dir, 'final', slug(p.title), '.mp4')
  const final = inProject(proj.dir, rel)
  const [DW, DH] = DELIVERY_SIZE[p.settings.aspect] ?? [1920, 1080]
  const vf = upscale ? `scale=${DW}:${DH}:flags=lanczos,unsharp=5:5:0.35:5:5:0,format=yuv420p` : 'format=yuv420p'
  const args = ['-y', '-v', 'error', '-i', join(build, 'joined.mp4')]
  let mix = null
  if (music) {
    args.push('-stream_loop', '-1', '-i', music)
    mix = audio === 'mute'
      ? `[1:a]volume=${musicVolume},aresample=48000[a]`
      : `[0:a]volume=0.8[c];[1:a]volume=${musicVolume},aresample=48000[m];[c][m]amix=inputs=2:duration=first:normalize=0[a]`
  }
  args.push(...(mix ? ['-filter_complex', `[0:v]${vf}[v];${mix}`, '-map', '[v]', '-map', '[a]', '-shortest'] : ['-vf', vf, '-map', '0:v', '-map', '0:a']),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', final)
  await run('ffmpeg', args)
  const seconds = Math.round((await probe(final)).duration * 10) / 10
  p.output = { file: rel, version, seconds, parts: parts.map(({ shot, take, seconds: sec }) => ({ shot, take, seconds: sec })), at: new Date().toISOString() }
  await proj.save()
  return { ok: true, file: rel, version, seconds, missing, spent: committed(p), note: missing.length ? `left out (no finished take): ${missing.join(', ')}` : 'all shots included' }
}

export { readFile }
