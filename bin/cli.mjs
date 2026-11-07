#!/usr/bin/env node
/**
 *   ai-video-director mcp                  start the MCP server on stdio (for Codex / any MCP client)
 *   ai-video-director console <folder>     open the review console for a project, or a folder of projects
 *   ai-video-director status <project>     print where a project stands
 *   ai-video-director login                authorize this computer (one browser click)
 *   ai-video-director save-key             read a key from stdin and save it (no shell history, no transcript)
 *   ai-video-director styles [en|zh]       list the style presets
 */

import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { login, storeKey, looksLikeKey, resolveKey, openInBrowser } from '../engine/api.mjs'
import { openProject } from '../engine/project.mjs'
import { listStyles } from '../engine/styles.mjs'
import { summary } from '../engine/status.mjs'

const [cmd, ...rest] = process.argv.slice(2)

async function main() {
  if (cmd === 'mcp') { await import('../mcp/server.mjs'); return null }
  if (cmd === 'console') {
    const { startConsole } = await import('../console/server.mjs')
    const root = resolve(rest.find((x) => !x.startsWith('--')) || 'films')
    if (!existsSync(root)) { console.error(`no such folder: ${root}`); return 2 }
    const portArg = rest.indexOf('--port')
    const c = await startConsole({ root, port: portArg >= 0 ? Number(rest[portArg + 1]) : 4318 }).catch(() => startConsole({ root, port: 0 }))
    console.log(`Video Director console: ${c.url}\n(only reachable from this computer; Ctrl-C to stop)`)
    if (!rest.includes('--no-open')) openInBrowser(c.url)
    return null
  }
  if (cmd === 'status') {
    const proj = await openProject(resolve(rest[0] || '.'))
    console.log(JSON.stringify(await summary(proj), null, 2))
    return 0
  }
  if (cmd === 'login') {
    const r = await login()
    if (!r.ok) { console.error(`✗ ${r.error}`); return 2 }
    console.log(`✓ saved (…${r.tail}). The MCP server, the console and other apimodels skills will use it.`)
    return 0
  }
  if (cmd === 'save-key') {
    const chunks = []
    for await (const c of process.stdin) chunks.push(c)
    const k = Buffer.concat(chunks).toString('utf8').trim()
    if (!looksLikeKey(k)) { console.error('That does not look like an apimodels key (sk_…). Nothing was saved.'); return 2 }
    await storeKey(k)
    console.log(`✓ saved (…${k.slice(-4)}), readable only by you.`)
    return 0
  }
  if (cmd === 'key-status') { console.log((await resolveKey()) ? 'key found' : 'no key'); return 0 }
  if (cmd === 'styles') {
    for (const s of listStyles(rest[0] || 'en')) console.log(`${s.id.padEnd(22)} ${s.name} — ${s.summary}`)
    return 0
  }
  console.log(`Usage:
  ai-video-director mcp                   MCP server on stdio (Codex, Cursor, any MCP client)
  ai-video-director console <folder>      review console for a project or a folder of projects
  ai-video-director status <project>      where a project stands
  ai-video-director login                 authorize this computer with apimodels.app
  ai-video-director styles [en|zh]        style presets`)
  return cmd ? 2 : 0
}

main().then((code) => { if (code != null) process.exit(code) }, (e) => { console.error(`✗ ${e.message}`); process.exit(1) })
