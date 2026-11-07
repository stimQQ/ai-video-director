/**
 * Where the project stands and what to do next — the one view both the agent (via
 * director_status) and the console read, so they never disagree.
 *
 * `next` is an instruction for the agent (English). `stage` is the same thing as a
 * code plus arguments, which the console turns into a sentence for the user in their
 * own language ("waiting for you: storyboard").
 */

import {
  readApprovals, statusOf, approvalKeys, committed, billedTotal, estimateRemaining, currentHash,
  effectiveVideoModel, effectiveResolution, shotSeconds, estimateShot,
} from './project.mjs'

export async function summary(proj) {
  const p = proj.data
  const approvals = await readApprovals(proj.dir)
  const items = {}
  for (const key of approvalKeys(p)) items[key] = await statusOf(proj, approvals, key)
  const shots = []
  for (const s of p.shots) {
    const h = await currentHash(proj, `frames:${s.id}`)
    shots.push({
      id: s.id,
      frames: { first: s.selected?.first ?? null, last: s.selected?.last ?? null },
      approval: items[`frames:${s.id}`].status,
      review: s.review ? { verdict: s.review.verdict, current: s.review.hash === h, issues: s.review.issues ?? [] } : null,
      model: effectiveVideoModel(p, s), resolution: effectiveResolution(p, s), seconds: shotSeconds(s), estimate: estimateShot(p, s),
      takes: (s.takes || []).map((t) => ({ take: t.take, state: t.state, file: t.file ?? null, cost: t.cost ?? null, error: t.error ?? null, stale: t.hash !== h })),
      picked_take: approvals.take_pick[s.id] ?? null,
    })
  }
  const budget = approvals.budget_usd
  const spent = committed(p)
  const remaining = estimateRemaining(p)
  const step = nextStep(p, items, budget, shots)
  return {
    title: p.title,
    settings: p.settings,
    budget: { usd: budget, committed: spent, billed: billedTotal(p), left: budget > 0 ? Math.round((budget - spent) * 1e4) / 1e4 : null, remaining_shots_estimate: remaining.total },
    approvals: items,
    feedback: Object.values(items).filter((x) => x.status === 'rejected' || (x.status === 'awaiting' && x.last?.comment)).map((x) => ({ key: x.key, comment: x.comment ?? x.last?.comment ?? '' })),
    notes: approvals.log.filter((x) => x.status === 'note').slice(-20),
    style_pick: approvals.style_pick,
    shots,
    in_flight: Object.entries(p.tasks).map(([slot, t]) => ({ slot, task_id: t.task_id })).concat(
      p.shots.flatMap((s) => (s.takes || []).filter((t) => t.state === 'submitted').map((t) => ({ slot: `video:${s.id}#${t.take}`, task_id: t.task_id })))),
    output: p.output,
    next: step.text,
    stage: { code: step.code, arg: step.arg ?? null },
  }
}

/** The next thing to do: a sentence for the agent and a code for the console. */
function nextStep(p, items, budget, shots) {
  const st = (k) => items[k]?.status
  const waitOrFix = (k, label) => {
    const s = st(k)
    if (s === 'empty') return { code: 'agent_writing', arg: k, text: `Write the ${label} and save it.` }
    if (s === 'awaiting' || s === 'stale') return { code: 'waiting_for_user', arg: k, text: `Wait for the user to confirm the ${label} in the console (director_wait).` }
    if (s === 'rejected') return { code: 'agent_revising', arg: k, text: `The user sent the ${label} back: “${items[k].comment || 'no comment'}”. Revise it and save again.` }
    return null
  }
  if (!(budget > 0) || st('settings') !== 'approved') {
    return { code: 'need_settings', text: 'Ask the user to set the length, aspect ratio and budget in the console and confirm them (director_console, then director_wait).' }
  }
  for (const [k, label] of [['story', 'story'], ['style', 'style'], ...p.cast.map((c) => [`cast:${c.id}`, `sheet for ${c.id}`]), ['storyboard', 'storyboard']]) {
    const m = waitOrFix(k, label)
    if (m) return m
  }
  for (const s of shots) {
    if (!s.frames.first || !s.frames.last) return { code: 'agent_drawing', arg: s.id, text: `Draw the first and last frame of ${s.id} (director_image), then check them (director_compare).` }
    if (!s.review?.current) return { code: 'in_review', arg: s.id, text: `Have a fresh reviewer check ${s.id} (frames + video prompt) and record the verdict (director_review).` }
    if (s.review.verdict !== 'pass') return { code: 'agent_revising', arg: `frames:${s.id}`, text: `Fix what the reviewer found in ${s.id}, then review again.` }
    const m = waitOrFix(`frames:${s.id}`, `frames of ${s.id}`)
    if (m) return m
  }
  const todo = shots.filter((s) => !s.takes.some((t) => t.state === 'done' || t.state === 'submitted'))
  if (todo.length) return { code: 'ready_to_render', arg: todo.map((s) => s.id).join(', '), text: `Render ${todo.map((s) => s.id).join(', ')} (director_render), one by one or a few at a time.` }
  const running = shots.filter((s) => s.takes.some((t) => t.state === 'submitted'))
  if (running.length) return { code: 'rendering', arg: running.map((s) => s.id).join(', '), text: `Keep waiting for ${running.map((s) => s.id).join(', ')} (call director_render again for each).` }
  if (!p.output) return { code: 'cutting', text: 'Check every take (director_frames), then cut the film (director_assemble).' }
  return { code: 'final_review', text: 'Have a fresh reviewer watch the final cut as a first-time viewer, then report to the user.' }
}

/** Record a reviewer's verdict for the shot exactly as it is now. */
export async function recordReview(proj, { shot, verdict, issues = [], reviewer = 'reviewer' }) {
  if (!['pass', 'fail'].includes(verdict)) throw new Error('verdict must be pass or fail')
  const s = proj.data.shots.find((x) => x.id === shot)
  if (!s) throw new Error(`no shot "${shot}"`)
  const hash = await currentHash(proj, `frames:${shot}`)
  if (!s.selected?.first || !s.selected?.last || !s.video_prompt) throw new Error(`${shot} needs a first frame, a last frame and a video prompt before it can be reviewed`)
  s.review = { verdict, issues: issues.map(String), reviewer, hash, at: new Date().toISOString() }
  await proj.save()
  return { ok: true, shot, verdict, hash }
}
