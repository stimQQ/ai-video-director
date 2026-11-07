/**
 * The project folder and the rules that keep money from being spent too early.
 *
 *   <project>/director.json   — the plan and every result. Written by the agent's
 *                               tools (MCP server / CLI), never by the console.
 *   <project>/approvals.json  — the user's decisions: approve / reject + comment,
 *                               the budget, picked takes. Written ONLY by the console,
 *                               i.e. by a person clicking a button.
 *
 * Every decision is bound to a hash of what the user looked at. If the story, the
 * storyboard or a keyframe changes after it was approved, the approval no longer
 * matches and the gate closes again — an agent cannot approve something by editing
 * it after the fact. Gates are checked here, in code, before every paid call; the
 * skill's instructions are a second line, not the only one.
 */

import { readFile, writeFile, rename, mkdir, stat, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve, extname, basename, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { imagePrice, videoPrice, IMAGE_PRICES, VIDEO_PRICES, VIDEO_SECONDS } from './api.mjs'
import { styleById } from './styles.mjs'

export const ASPECTS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9']
export const SHOT_ID = /^[a-z0-9][a-z0-9-]{0,31}$/
const SHOT_FIELDS = ['duration_s', 'size', 'angle', 'movement', 'blocking', 'mover', 'transition', 'description', 'first_plan', 'last_plan']

// ─── hashing ────────────────────────────────────────────────────────────────

const stable = (v) => {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`
  return JSON.stringify(v ?? null)
}
export const hashOf = (v) => createHash('sha1').update(stable(v)).digest('hex').slice(0, 16)

const fileHashes = new Map() // path → { mtimeMs, size, hash }
export async function fileHash(path) {
  if (!path) return null
  try {
    const s = await stat(path)
    const hit = fileHashes.get(path)
    if (hit && hit.mtimeMs === s.mtimeMs && hit.size === s.size) return hit.hash
    const hash = createHash('sha1').update(await readFile(path)).digest('hex').slice(0, 16)
    fileHashes.set(path, { mtimeMs: s.mtimeMs, size: s.size, hash })
    return hash
  } catch { return null }
}

// ─── project file ───────────────────────────────────────────────────────────

export function blankProject({ title = 'Untitled', language = 'en', length_s = 30, aspect = '16:9' } = {}) {
  return {
    version: 1,
    title,
    language,
    created_at: new Date().toISOString(),
    settings: {
      length_s, aspect, music: false, subtitles: false,
      image_model: 'gpt-image-2', image_resolution: '1K',
      video_model: null, // null → the style preset's choice
      video_resolution: '480p',
    },
    story: { logline: '', text: '', beats: [] },
    style: { preset: null, notes: '', image: '', video: '', palette: [], samples: [], selected: [] },
    cast: [],
    shots: [],
    tasks: {}, // in-flight image tasks, by slot — picked up again instead of paying twice
    spend: [],
    output: null,
  }
}

const loaded = new Map() // dir → project handle

/**
 * Open a project folder. Writes are queued and atomic (temp file + rename), so two
 * tool calls finishing at once cannot interleave or leave a half-written file.
 */
export async function openProject(dir) {
  dir = resolve(dir)
  const file = join(dir, 'director.json')
  const s = await stat(file).catch(() => null)
  if (!s) throw Object.assign(new Error(`no project at ${dir} (director.json missing) — create one first`), { code: 'NO_PROJECT' })
  const hit = loaded.get(dir)
  if (hit && hit.mtimeMs === s.mtimeMs) return hit
  const data = JSON.parse(await readFile(file, 'utf8'))
  let chain = hit?.chain ?? Promise.resolve()
  const handle = {
    dir, file, data, mtimeMs: s.mtimeMs,
    save() {
      chain = handle.chain = chain.then(async () => {
        const tmp = `${file}.tmp-${process.pid}`
        await writeFile(tmp, JSON.stringify(handle.data, null, 2) + '\n')
        await rename(tmp, file)
        handle.mtimeMs = (await stat(file)).mtimeMs
      })
      return chain
    },
    chain,
  }
  loaded.set(dir, handle)
  return handle
}

export async function createProject(dir, opts) {
  dir = resolve(dir)
  if (existsSync(join(dir, 'director.json'))) throw new Error(`a project already exists at ${dir}`)
  await mkdir(dir, { recursive: true })
  const data = blankProject(opts)
  await writeFile(join(dir, 'director.json'), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' })
  return openProject(dir)
}

/** Resolve a path the project stores (always relative) and refuse anything outside it. */
export function inProject(dir, rel) {
  const full = resolve(dir, rel)
  if (full !== dir && !full.startsWith(dir + sep)) throw new Error(`path escapes the project folder: ${rel}`)
  return full
}

/**
 * The next free versioned name: frames/s01/first-v3.png. Results are never written
 * over an earlier version — a re-render or a re-draw always lands next to the old one.
 */
export async function nextVersion(dir, sub, base, ext) {
  const folder = join(dir, sub)
  await mkdir(folder, { recursive: true })
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-v(\\d+)\\.`)
  let max = 0
  for (const name of await readdir(folder)) {
    const m = name.match(re)
    if (m) max = Math.max(max, Number(m[1]))
  }
  const version = max + 1
  return { version, rel: `${sub}/${base}-v${version}${ext}` }
}

// ─── approvals (read-only here; the console writes them) ────────────────────

export async function readApprovals(dir) {
  try {
    const a = JSON.parse(await readFile(join(dir, 'approvals.json'), 'utf8'))
    return { items: a.items ?? {}, budget_usd: a.budget_usd ?? null, style_pick: a.style_pick ?? null, take_pick: a.take_pick ?? {}, log: a.log ?? [] }
  } catch { return { items: {}, budget_usd: null, style_pick: null, take_pick: {}, log: [] } }
}

// ─── what each approval covers ──────────────────────────────────────────────

export const shotPlan = (s) => Object.fromEntries(['id', ...SHOT_FIELDS].map((k) => [k, s[k] ?? null]))

export function effectiveVideoModel(p, shot) {
  return shot?.model || p.settings.video_model || styleById(p.style.preset)?.video_model || 'seedance-2.0-mini'
}
export const effectiveResolution = (p, shot) => shot?.resolution || p.settings.video_resolution || '480p'
export const shotSeconds = (s) => Math.min(VIDEO_SECONDS.max, Math.max(VIDEO_SECONDS.min, Math.ceil(Number(s.duration_s) || VIDEO_SECONDS.min)))

/** The hash of everything a given approval key covers, right now. */
export async function currentHash(proj, key) {
  const p = proj.data
  const f = (rel) => (rel ? fileHash(inProject(proj.dir, rel)) : null)
  if (key === 'settings') {
    const { length_s, aspect, music, subtitles } = p.settings
    return hashOf({ length_s, aspect, music, subtitles })
  }
  if (key === 'story') return hashOf(p.story)
  if (key === 'style') {
    const { preset, notes, image, video, palette, selected } = p.style
    return hashOf({ preset, notes, image, video, palette, files: await Promise.all((selected || []).map(f)) })
  }
  if (key === 'storyboard') return hashOf(p.shots.map(shotPlan))
  if (key.startsWith('cast:')) {
    const c = p.cast.find((x) => x.id === key.slice(5))
    if (!c) return null
    return hashOf({ name: c.name, look: c.look, fixed: c.fixed ?? '', sheet: await f(c.selected) })
  }
  if (key.startsWith('frames:')) {
    const s = p.shots.find((x) => x.id === key.slice(7))
    if (!s) return null
    return hashOf({
      first: await f(s.selected?.first), last: await f(s.selected?.last), prompt: s.video_prompt ?? '',
      seconds: shotSeconds(s), model: effectiveVideoModel(p, s), resolution: effectiveResolution(p, s),
    })
  }
  return null
}

/**
 * Where an approval key stands:
 *   empty     — nothing to review yet
 *   awaiting  — waiting for the user (never decided, or changed since the last decision)
 *   approved  — approved, and it is still exactly what was approved
 *   rejected  — the user sent this exact version back (see comment)
 *   stale     — approved once, changed since → needs approving again
 */
export async function statusOf(proj, approvals, key) {
  const hash = await currentHash(proj, key)
  const d = approvals.items[key]
  if (!hasContent(proj.data, key)) return { key, status: 'empty', hash }
  if (!d) return { key, status: 'awaiting', hash }
  if (d.hash !== hash) return { key, status: d.status === 'approved' ? 'stale' : 'awaiting', hash, last: d }
  return { key, status: d.status === 'approved' ? 'approved' : 'rejected', hash, comment: d.comment ?? '', at: d.at }
}

function hasContent(p, key) {
  if (key === 'settings') return true
  if (key === 'story') return !!(p.story.text || p.story.logline)
  if (key === 'style') return !!(p.style.preset || p.style.image)
  if (key === 'storyboard') return p.shots.length > 0
  if (key.startsWith('cast:')) return !!p.cast.find((x) => x.id === key.slice(5))?.selected
  if (key.startsWith('frames:')) {
    const s = p.shots.find((x) => x.id === key.slice(7))
    return !!(s?.selected?.first && s?.selected?.last && s?.video_prompt)
  }
  return false
}

export function approvalKeys(p) {
  return ['settings', 'story', 'style', ...p.cast.map((c) => `cast:${c.id}`), 'storyboard', ...p.shots.map((s) => `frames:${s.id}`)]
}

// ─── money ──────────────────────────────────────────────────────────────────

/** Everything spent or committed: billed amounts where known, estimates otherwise. */
export function committed(p) {
  let total = 0
  for (const e of p.spend) total += e.cost ?? e.estimate ?? 0
  return Math.round(total * 1e4) / 1e4
}
export const billedTotal = (p) => Math.round(p.spend.reduce((n, e) => n + (e.cost ?? 0), 0) * 1e4) / 1e4

export function estimateImage(p, model, res) {
  return imagePrice(model || p.settings.image_model, res || p.settings.image_resolution)
}
export function estimateShot(p, s) {
  return videoPrice(effectiveVideoModel(p, s), effectiveResolution(p, s), shotSeconds(s))
}

/** Remaining shots that still need a first take, priced. */
export function estimateRemaining(p) {
  const rows = p.shots
    .filter((s) => !(s.takes || []).some((t) => t.state === 'done' || t.state === 'submitted'))
    .map((s) => ({ shot: s.id, model: effectiveVideoModel(p, s), resolution: effectiveResolution(p, s), seconds: shotSeconds(s), usd: estimateShot(p, s) }))
  const total = Math.round(rows.reduce((n, r) => n + (r.usd ?? 0), 0) * 1e4) / 1e4
  return { rows, total }
}

// ─── gates ──────────────────────────────────────────────────────────────────

const STEP_NEEDS = {
  // What has to be approved, as it is now, before each kind of paid call.
  style: ['settings', 'story'],
  cast: ['settings', 'story', 'style'],
  frame: ['settings', 'story', 'style', 'storyboard'],
}

/**
 * May this paid action run? Returns { ok, blockers[] }. `cost` is the estimate of
 * the call about to be made; it must fit in what is left of the user's budget.
 */
export async function gate(proj, action, { shotId, cost } = {}) {
  const p = proj.data
  const approvals = await readApprovals(proj.dir)
  const blockers = []
  const need = async (key) => {
    const st = await statusOf(proj, approvals, key)
    if (st.status !== 'approved') blockers.push({ key, status: st.status, ...(st.comment ? { comment: st.comment } : {}), ...(st.last?.comment ? { comment: st.last.comment } : {}) })
  }

  if (action === 'render') {
    const s = p.shots.find((x) => x.id === shotId)
    if (!s) return { ok: false, blockers: [{ key: `frames:${shotId}`, status: 'unknown shot' }] }
    for (const key of ['settings', 'story', 'style', 'storyboard', ...p.cast.map((c) => `cast:${c.id}`), `frames:${shotId}`]) await need(key)
    const h = await currentHash(proj, `frames:${shotId}`)
    if (!(s.review?.verdict === 'pass' && s.review.hash === h)) {
      blockers.push({ key: `review:${shotId}`, status: s.review ? (s.review.hash === h ? `review ${s.review.verdict}` : 'review is for an older version') : 'not reviewed' })
    }
  } else {
    const keys = STEP_NEEDS[action]
    if (!keys) throw new Error(`unknown action ${action}`)
    for (const key of keys) await need(key)
    if (action === 'frame') for (const c of p.cast) await need(`cast:${c.id}`)
  }

  const budget = approvals.budget_usd
  if (!(budget > 0)) blockers.push({ key: 'budget', status: 'no budget set — the user sets it in the console' })
  else if (cost == null) blockers.push({ key: 'budget', status: 'price unknown for this model / resolution, so it cannot be checked against the budget' })
  else if (committed(p) + cost > budget + 1e-9) {
    blockers.push({ key: 'budget', status: `over budget: committed $${committed(p).toFixed(3)} + this $${cost.toFixed(3)} > $${budget.toFixed(2)}` })
  }
  return { ok: blockers.length === 0, blockers }
}

export function describeBlockers(blockers) {
  return blockers.map((b) => `• ${b.key}: ${b.status}${b.comment ? ` — user said: “${b.comment}”` : ''}`).join('\n')
}

// ─── editing the plan (agent side) ──────────────────────────────────────────

/** Validate and apply a section the agent wrote. Returns a list of problems (empty = applied). */
export function applySection(p, section, data) {
  const problems = []
  if (section === 'settings') {
    const s = { ...p.settings }
    for (const k of ['length_s', 'aspect', 'music', 'subtitles', 'image_model', 'image_resolution', 'video_model', 'video_resolution']) if (k in data) s[k] = data[k]
    if (!ASPECTS.includes(s.aspect)) problems.push(`aspect must be one of ${ASPECTS.join(', ')}`)
    if (!(Number(s.length_s) > 0)) problems.push('length_s must be a positive number of seconds')
    if (!IMAGE_PRICES[s.image_model]) problems.push(`image_model must be one of ${Object.keys(IMAGE_PRICES).join(', ')}`)
    if (s.video_model && !VIDEO_PRICES[s.video_model]) problems.push(`video_model must be one of ${Object.keys(VIDEO_PRICES).join(', ')}`)
    if (!problems.length) p.settings = s
  } else if (section === 'story') {
    p.story = { logline: String(data.logline ?? p.story.logline ?? ''), text: String(data.text ?? p.story.text ?? ''), beats: Array.isArray(data.beats) ? data.beats.map(String) : p.story.beats }
    if (!p.story.logline) problems.push('a one-sentence logline (what the film is saying) is required')
  } else if (section === 'style') {
    const preset = data.preset ?? p.style.preset
    const base = preset ? styleById(preset) : null
    if (preset && !base) problems.push(`unknown style preset ${preset}`)
    p.style = {
      ...p.style,
      preset,
      notes: String(data.notes ?? p.style.notes ?? ''),
      image: String(data.image ?? (p.style.image || base?.image || '')),
      video: String(data.video ?? (p.style.video || base?.video || '')),
      palette: Array.isArray(data.palette) ? data.palette : (p.style.palette?.length ? p.style.palette : base?.palette ?? []),
      ...(Array.isArray(data.selected) ? { selected: data.selected } : {}),
    }
  } else if (section === 'cast') {
    if (!Array.isArray(data)) return ['cast must be an array of { id, name, look, fixed }']
    const old = new Map(p.cast.map((c) => [c.id, c]))
    const next = []
    for (const c of data) {
      if (!SHOT_ID.test(c.id || '')) { problems.push(`cast id "${c.id}" must be lowercase letters, digits or dashes`); continue }
      const prev = old.get(c.id) || { sheets: [], selected: null }
      next.push({ ...prev, id: c.id, name: String(c.name ?? prev.name ?? c.id), look: String(c.look ?? prev.look ?? ''), fixed: String(c.fixed ?? prev.fixed ?? '') })
    }
    if (!problems.length) p.cast = next
  } else if (section === 'storyboard') {
    if (!Array.isArray(data)) return ['storyboard must be an array of shots']
    const old = new Map(p.shots.map((s) => [s.id, s]))
    const seen = new Set()
    const next = []
    for (const s of data) {
      if (!SHOT_ID.test(s.id || '')) { problems.push(`shot id "${s.id}" must be lowercase letters, digits or dashes`); continue }
      if (seen.has(s.id)) { problems.push(`duplicate shot id ${s.id}`); continue }
      seen.add(s.id)
      const prev = old.get(s.id) || { frames: { first: [], last: [] }, selected: {}, takes: [] }
      const plan = Object.fromEntries(SHOT_FIELDS.map((k) => [k, s[k] ?? prev[k] ?? null]))
      if (!(Number(plan.duration_s) > 0)) problems.push(`${s.id}: duration_s is required`)
      next.push({ ...prev, id: s.id, ...plan, ...(s.video_prompt != null ? { video_prompt: String(s.video_prompt) } : {}) })
    }
    if (!problems.length) p.shots = next
  } else if (section === 'shot') {
    const s = p.shots.find((x) => x.id === data.id)
    if (!s) return [`no shot ${data.id} in the storyboard`]
    for (const k of SHOT_FIELDS) if (k in data) s[k] = data[k]
    if ('video_prompt' in data) s.video_prompt = String(data.video_prompt)
    if ('model' in data) {
      if (data.model && !VIDEO_PRICES[data.model]) problems.push(`model must be one of ${Object.keys(VIDEO_PRICES).join(', ')}`)
      else s.model = data.model || null
    }
    if ('resolution' in data) s.resolution = data.resolution || null
    if (data.selected) s.selected = { ...s.selected, ...data.selected }
  } else {
    problems.push(`unknown section ${section}`)
  }
  return problems
}

export const relToProject = (dir, full) => full.slice(dir.length + 1).split(sep).join('/')
export const isImage = (f) => /\.(png|jpe?g|webp)$/i.test(f)
export { extname, basename }
