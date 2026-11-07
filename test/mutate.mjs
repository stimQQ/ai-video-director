// Mutation check for the guards: break each one on purpose, run the tests, and
// expect them to fail. A guard whose removal no test notices is not tested.
//
//   node test/mutate.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const M = [
  ['engine/project.mjs', 'no budget → refuse', "if (!(budget > 0)) blockers.push", 'if (false) blockers.push'],
  ['engine/project.mjs', 'over budget → refuse', 'else if (committed(p) + cost > budget + 1e-9)', 'else if (false)'],
  ['engine/project.mjs', 'render needs a current review pass', "if (!(s.review?.verdict === 'pass' && s.review.hash === h))", 'if (false)'],
  ['engine/project.mjs', 'approval must match current content', 'if (d.hash !== hash) return', 'if (false) return'],
  ['engine/project.mjs', 'prompt is part of the shot approval', "prompt: s.video_prompt ?? '',", ''],
  ['engine/project.mjs', 'versions never overwrite', 'const version = max + 1', 'const version = 1'],
  ['engine/project.mjs', 'unknown sections are refused', "problems.push(`unknown section ${section}`)", ''],
  ['engine/media.mjs', 'image gate is checked', "const g = await gate(proj, IMAGE_KINDS[kind], { cost })\n    if (!g.ok)", "const g = await gate(proj, IMAGE_KINDS[kind], { cost })\n    if (false)"],
  ['engine/media.mjs', 'render gate is checked', "const g = await gate(proj, 'render', { shotId: shot, cost })\n    if (!g.ok)", "const g = await gate(proj, 'render', { shotId: shot, cost })\n    if (false)"],
  ['engine/media.mjs', 'a submitted take is resumed', "let take = s.takes.find((t) => t.state === 'submitted')", 'let take = null'],
  ['engine/media.mjs', 'no second paid take unless asked', 'if (done && !newTake) return', 'if (false) return'],
  ['engine/media.mjs', 'failed video costs nothing', "take.error = r.message\n    const e = p.spend.find((x) => x.task_id === take.task_id)\n    if (e) e.cost = 0", "take.error = r.message\n    const e = p.spend.find((x) => x.task_id === take.task_id)"],
  ['engine/media.mjs', 'compare in one pixel format', ',setsar=1,format=gbrp`', ',setsar=1`'],
  ['engine/media.mjs', 'near-aspect clips are filled', 'const near = info.width && info.height && Math.abs((info.width / info.height) / (W / H) - 1) < 0.06', 'const near = false'],
  ['console/server.mjs', 'host header check', 'if (!hostOk) throw', 'if (false) throw'],
  ['console/server.mjs', 'token check', 'if (t !== token) throw', 'if (false) throw'],
  ['console/server.mjs', 'JSON-only posts (CSRF)', "if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw", 'if (false) throw'],
  ['console/server.mjs', 'no path traversal', '!full.startsWith(dir + sep) || ', ''],
  ['console/server.mjs', 'stale decision refused', 'if (b.hash && b.hash !== hash) throw', 'if (false) throw'],
  ['console/server.mjs', 'budget required to confirm settings', "if (!(budget > 0)) throw httpError(400, 'set a budget", "if (false) throw httpError(400, 'set a budget"],
  ['console/server.mjs', 'send back needs a comment', "if (b.status === 'rejected' && !comment.trim()) throw", 'if (false) throw'],
]

let missed = 0
for (const [file, name, find, replace] of M) {
  const path = join(root, file)
  const original = readFileSync(path, 'utf8')
  const count = original.split(find).length - 1
  if (count !== 1) { console.log(`?  ${name}: pattern found ${count} times in ${file} — fix the mutation`); missed++; continue }
  writeFileSync(path, original.replace(find, replace))
  try {
    const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-timeout=60000', 'test/engine.test.mjs', 'test/mcp.test.mjs'], { cwd: root, encoding: 'utf8' })
    if (r.status === 0) { console.log(`✗  ${name}: NOT caught`); missed++ } else console.log(`✓  ${name}: caught`)
  } finally {
    writeFileSync(path, original)
  }
}
console.log(missed ? `\n${missed} mutation(s) survived` : `\nall ${M.length} mutations caught`)
process.exit(missed ? 1 : 0)
