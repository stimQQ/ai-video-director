#!/usr/bin/env node
/**
 * MCP server (stdio) for Claude Code, Codex and any other MCP client. Zero
 * dependencies: newline-delimited JSON-RPC 2.0 on stdin/stdout, logs on stderr.
 *
 * The tools wrap the engine. Paid tools (director_image, director_render) refuse to
 * run until the user has approved the right steps in the console and set a budget;
 * that check lives in engine/project.mjs and cannot be talked around.
 */

import { readFile } from 'node:fs/promises'
import { join, resolve, isAbsolute, dirname } from 'node:path'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { resolveKey, openInBrowser, NO_KEY_HINT } from '../engine/api.mjs'
import { createProject, openProject, applySection, readApprovals, estimateRemaining, inProject, ASPECTS } from '../engine/project.mjs'
import { listStyles } from '../engine/styles.mjs'
import { generateImage, importImage, deriveFrame, compareFrames, renderShot, takeFrames, assemble, run, hasFfmpeg } from '../engine/media.mjs'
import { summary, recordReview } from '../engine/status.mjs'
import { startConsole } from '../console/server.mjs'

const PKG = JSON.parse(await readFile(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'))
const WAIT_S = Number(process.env.DIRECTOR_WAIT_S) || 100 // per call; a pending task resumes on the next call
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05']
const log = (...a) => process.stderr.write(`[video-director] ${a.join(' ')}\n`)

const consoles = new Map() // project dir → running console

const INSTRUCTIONS = `Video Director: make a short AI film from an idea, with the user approving each step in a local console before anything is paid for.
Order: director_new → user sets budget + settings in the console → story → style → (character sheets) → storyboard → per shot: first & last frame, director_compare, a fresh reviewer, user approval → director_render → director_frames → director_assemble.
The paid tools refuse to run until the needed steps are approved; when blocked, director_wait for the user instead of working around it. Never write approvals.json yourself. You cannot see motion or hear sound: say so.
Read the video-director skill for the full method (story rules, shot design, keyframe checks, the 7-block video prompt).`

const S = { type: 'string' }
const project = { type: 'string', description: 'Path to the project folder (the one with director.json).' }
const TOOLS = [
  {
    name: 'director_new',
    description: 'Create a project folder and open the review console. Ask the user for length, aspect, budget, music and subtitles first (or let them set it in the console).',
    inputSchema: { type: 'object', required: ['title'], properties: {
      title: S, dir: { type: 'string', description: 'Folder to create. Default: ./films/<title>' },
      length_s: { type: 'number' }, aspect: { type: 'string', enum: ASPECTS }, language: { type: 'string', description: 'en, zh, …' },
      music: { type: 'boolean' }, subtitles: { type: 'boolean' }, open: { type: 'boolean', description: 'Open the console in the browser (default true)' },
    } },
  },
  { name: 'director_styles', description: 'List the style presets (look, palette, most cost-efficient suitable video model, what tends to go wrong).', inputSchema: { type: 'object', properties: { lang: S } } },
  { name: 'director_status', description: 'Where the project stands: every approval and its comment, budget, shots, takes, in-flight tasks, and the next step.', inputSchema: { type: 'object', required: ['project'], properties: { project } } },
  {
    name: 'director_save',
    description: 'Write part of the plan. section: settings | story ({logline, text, beats[]}) | style ({preset, notes, image, video, palette[], selected[]}) | cast ([{id, name, look, fixed}]) | storyboard ([{id, duration_s, size, angle, movement, blocking, mover, transition, description, first_plan, last_plan, video_prompt?}]) | shot ({id, …any shot field, video_prompt, model, resolution, selected:{first,last}}). Changing anything the user approved re-opens it for approval.',
    inputSchema: { type: 'object', required: ['project', 'section', 'data'], properties: { project, section: { type: 'string', enum: ['settings', 'story', 'style', 'cast', 'storyboard', 'shot'] }, data: {} } },
  },
  { name: 'director_console', description: 'Start (or find) the review console for a project and return its URL.', inputSchema: { type: 'object', required: ['project'], properties: { project, open: { type: 'boolean' } } } },
  {
    name: 'director_wait',
    description: 'Wait for the user to decide something in the console (up to timeout_s, max 55). Returns the new decisions and comments. Call again if nothing came in.',
    inputSchema: { type: 'object', required: ['project'], properties: { project, timeout_s: { type: 'number' } } },
  },
  {
    name: 'director_image',
    description: 'PAID. Generate a style sample (kind=style), a character/prop sheet (kind=cast, id=cast id) or a shot keyframe (kind=first|last, id=shot id). refs: project-relative images to edit from or match (e.g. the last frame when drawing the first). The project style line is prepended for you. Refused until the needed steps are approved and the budget allows it. If it returns pending, call it again with the same kind and id to keep waiting (not charged twice).',
    inputSchema: { type: 'object', required: ['project', 'kind'], properties: {
      project, kind: { type: 'string', enum: ['style', 'cast', 'first', 'last'] }, id: S, prompt: S,
      refs: { type: 'array', items: S }, model: { type: 'string', enum: ['gpt-image-2', 'nano-banana-2-1'] }, resolution: { type: 'string', enum: ['1K', '2K', '4K'] }, aspect: { type: 'string' },
    } },
  },
  {
    name: 'director_import_image',
    description: 'Free. Bring in an image made elsewhere (your own image tool, the user\'s file) as a style sample, cast sheet or keyframe. It becomes the selected version.',
    inputSchema: { type: 'object', required: ['project', 'kind', 'path'], properties: { project, kind: { type: 'string', enum: ['style', 'cast', 'first', 'last'] }, id: S, path: S } },
  },
  {
    name: 'director_derive_frame',
    description: 'Free. Make one keyframe from the other by cropping in (zoom 1.05–3, centre cx/cy as fractions). Use it for a slow push-in: same camera, tighter framing.',
    inputSchema: { type: 'object', required: ['project', 'shot', 'zoom'], properties: { project, shot: S, from: { type: 'string', enum: ['first', 'last'] }, to: { type: 'string', enum: ['first', 'last'] }, zoom: { type: 'number' }, cx: { type: 'number' }, cy: { type: 'number' } } },
  },
  { name: 'director_compare', description: 'Free. Side by side + difference image: a shot\'s first vs last frame (shot), or any two project images (a, b), e.g. two versions of a frame after a local fix. Anything that must not change has to be black in the difference panel.', inputSchema: { type: 'object', required: ['project'], properties: { project, shot: S, a: S, b: S } } },
  { name: 'director_look', description: 'Free. Return a project image (downscaled) so you can look at it.', inputSchema: { type: 'object', required: ['project', 'path'], properties: { project, path: S, max_px: { type: 'number' } } } },
  {
    name: 'director_review',
    description: 'Record a reviewer verdict for a shot exactly as it is now (frames + prompt). Use a fresh reviewer that only finds problems. A render needs a current "pass".',
    inputSchema: { type: 'object', required: ['project', 'shot', 'verdict'], properties: { project, shot: S, verdict: { type: 'string', enum: ['pass', 'fail'] }, issues: { type: 'array', items: S }, reviewer: S } },
  },
  { name: 'director_estimate', description: 'Free. Price of the shots that still need a first take, at list prices.', inputSchema: { type: 'object', required: ['project'], properties: { project } } },
  {
    name: 'director_render',
    description: 'PAID. Render one take of a shot from its selected first + last frame and video prompt. Refused until the shot is approved by the user, reviewed "pass", and fits the budget. If it returns pending, call again for the same shot to keep waiting. new_take: true pays for another take; earlier takes are kept.',
    inputSchema: { type: 'object', required: ['project', 'shot'], properties: { project, shot: S, new_take: { type: 'boolean' } } },
  },
  { name: 'director_frames', description: 'Free. Contact sheet plus first and last frame of a take, so you can check it as stills.', inputSchema: { type: 'object', required: ['project', 'shot'], properties: { project, shot: S, take: { type: 'number' }, count: { type: 'number' } } } },
  {
    name: 'director_assemble',
    description: 'Free. Cut the chosen takes (the user\'s picks, else the latest) into a film: optional trims {shot:{start,end}}, 1080p upscale, keep clip audio or mute, optional music file.',
    inputSchema: { type: 'object', required: ['project'], properties: { project, takes: { type: 'object' }, trims: { type: 'object' }, upscale: { type: 'boolean' }, audio: { type: 'string', enum: ['clips', 'mute'] }, music: S, music_volume: { type: 'number' } } },
  },
]

const projDir = (p) => resolve(isAbsolute(p) ? p : join(process.cwd(), p))

async function ensureConsole(dir, open) {
  let c = consoles.get(dir)
  if (!c) {
    c = await startConsole({ root: dir })
    consoles.set(dir, c)
    log(`console for ${dir} at ${c.url}`)
  }
  if (open) openInBrowser(c.url)
  return c
}

async function key() {
  const k = await resolveKey()
  if (!k) throw new Error(NO_KEY_HINT)
  return k
}

const text = (o) => ({ content: [{ type: 'text', text: typeof o === 'string' ? o : JSON.stringify(o, null, 2) }] })

async function callTool(name, a) {
  if (name === 'director_new') {
    const slug = String(a.title).toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'film'
    const dir = projDir(a.dir || join('films', slug))
    const proj = await createProject(dir, { title: a.title, language: a.language || 'en', length_s: a.length_s || 30, aspect: a.aspect || '16:9' })
    if (a.music != null || a.subtitles != null) {
      applySection(proj.data, 'settings', { ...(a.music != null ? { music: !!a.music } : {}), ...(a.subtitles != null ? { subtitles: !!a.subtitles } : {}) })
      await proj.save()
    }
    const c = await ensureConsole(dir, a.open !== false)
    const ff = await hasFfmpeg()
    return text({ ok: true, project: dir, console: c.url, ffmpeg: ff, key: !!(await resolveKey()),
      next: 'Tell the user the console link. They set the budget and confirm the settings there; then write the story (director_save section=story).',
      ...(ff ? {} : { warning: 'ffmpeg is not installed; keyframe checks, renders and the cut need it.' }),
      ...((await resolveKey()) ? {} : { warning_key: NO_KEY_HINT }) })
  }
  if (name === 'director_styles') return text({ styles: listStyles(a.lang || 'en') })

  const dir = projDir(a.project)
  const proj = await openProject(dir)

  switch (name) {
    case 'director_status': return text(await summary(proj))
    case 'director_save': {
      const problems = applySection(proj.data, a.section, a.data ?? {})
      if (problems.length) return { ...text({ ok: false, problems }), isError: true }
      await proj.save()
      const sum = await summary(proj)
      return text({ ok: true, saved: a.section, next: sum.next })
    }
    case 'director_console': {
      const c = await ensureConsole(dir, !!a.open)
      return text({ url: c.url, note: 'Give the user this link. It only works on this computer.' })
    }
    case 'director_wait': {
      const timeout = Math.min(55, Math.max(1, Number(a.timeout_s) || 50)) * 1000
      const start = (await readApprovals(dir)).log.length
      const until = Date.now() + timeout
      while (Date.now() < until) {
        const ap = await readApprovals(dir)
        if (ap.log.length > start) {
          const sum = await summary(proj)
          return text({ decisions: ap.log.slice(start), next: sum.next, budget: sum.budget })
        }
        await new Promise((r) => setTimeout(r, 1000))
      }
      return text({ decisions: [], note: 'Nothing new yet. Call director_wait again, or remind the user of the console link.' })
    }
    case 'director_image': {
      const r = await generateImage(proj, await key(), { kind: a.kind, id: a.id, prompt: a.prompt, refs: a.refs || [], model: a.model, resolution: a.resolution, aspect: a.aspect, waitS: WAIT_S })
      return r.ok || r.pending ? text(r) : { ...text(r), isError: !r.blocked }
    }
    case 'director_import_image': return text(await importImage(proj, { kind: a.kind, id: a.id, path: resolve(a.path) }))
    case 'director_derive_frame': return text(await deriveFrame(proj, a))
    case 'director_compare': return text(await compareFrames(proj, a))
    case 'director_look': {
      const full = inProject(dir, a.path)
      if (!existsSync(full)) throw new Error(`no such file: ${a.path}`)
      const max = Math.min(2048, Math.max(256, Number(a.max_px) || 1024))
      const out = join(tmpdir(), `director-look-${process.pid}-${Date.now()}.jpg`)
      await run('ffmpeg', ['-y', '-v', 'error', '-i', full, '-vf', `scale='min(${max},iw)':-2`, '-frames:v', '1', '-q:v', '4', out])
      const data = (await readFile(out)).toString('base64')
      return { content: [{ type: 'image', data, mimeType: 'image/jpeg' }, { type: 'text', text: a.path }] }
    }
    case 'director_review': return text(await recordReview(proj, a))
    case 'director_estimate': return text(estimateRemaining(proj.data))
    case 'director_render': {
      const r = await renderShot(proj, await key(), { shot: a.shot, newTake: !!a.new_take, waitS: WAIT_S })
      return r.ok || r.pending ? text(r) : { ...text(r), isError: !r.blocked }
    }
    case 'director_frames': return text(await takeFrames(proj, a))
    case 'director_assemble': return text(await assemble(proj, { takes: a.takes, trims: a.trims, upscale: a.upscale !== false, audio: a.audio || 'clips', music: a.music ? resolve(a.music) : null, musicVolume: a.music_volume ?? 0.5 }))
    default: throw new Error(`unknown tool ${name}`)
  }
}

// ─── JSON-RPC over stdio ─────────────────────────────────────────────────────

const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n')

async function handle(msg) {
  const { id, method, params } = msg
  const reply = (result) => id !== undefined && send({ jsonrpc: '2.0', id, result })
  const error = (code, message) => id !== undefined && send({ jsonrpc: '2.0', id, error: { code, message } })
  try {
    if (method === 'initialize') {
      const want = params?.protocolVersion
      return reply({
        protocolVersion: PROTOCOLS.includes(want) ? want : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'video-director', version: PKG.version },
        instructions: INSTRUCTIONS,
      })
    }
    if (method === 'ping') return reply({})
    if (method === 'tools/list') return reply({ tools: TOOLS })
    if (method === 'tools/call') {
      const name = params?.name
      if (!TOOLS.some((t) => t.name === name)) return error(-32602, `unknown tool ${name}`)
      try {
        return reply(await callTool(name, params?.arguments ?? {}))
      } catch (e) {
        return reply({ content: [{ type: 'text', text: e.message }], isError: true })
      }
    }
    if (typeof method === 'string' && method.startsWith('notifications/')) return
    return error(-32601, `method not found: ${method}`)
  } catch (e) {
    return error(-32603, e.message)
  }
}

let buf = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  buf += chunk
  let i
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim()
    buf = buf.slice(i + 1)
    if (!line) continue
    let msg
    try { msg = JSON.parse(line) } catch { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }); continue }
    handle(msg)
  }
})
process.stdin.on('end', async () => {
  for (const c of consoles.values()) await c.close().catch(() => {})
  process.exit(0)
})
log(`v${PKG.version} ready (API ${process.env.APIMODELS_BASE_URL || 'https://api.apimodels.app/v1'})`)
