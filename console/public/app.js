/* Video Director console. No framework, no build step. Everything the agent wrote
   is shown with textContent (never innerHTML), so a prompt can never inject markup. */

const TOKEN = document.querySelector('meta[name="director-token"]').content
const T = {
  en: {
    tabs: { settings: 'Settings & budget', story: 'Story', style: 'Style', cast: 'Characters', storyboard: 'Storyboard', frames: 'Keyframes', clips: 'Shots', final: 'Final cut', log: 'History' },
    status: { empty: 'nothing yet', awaiting: 'waiting for you', approved: 'approved', rejected: 'sent back', stale: 'changed since you approved' },
    approve: 'Approve', reject: 'Send back', commentPh: 'What should change? (required to send back; optional when approving)',
    youSaid: 'You said', budget: 'Budget (USD)', budgetHelp: 'Nothing is generated before you set this. Every paid call is checked against it.',
    spent: 'committed', of: 'of', left: 'left', noBudget: 'no budget set',
    length: 'Length', aspect: 'Aspect ratio', music: 'Music', subtitles: 'Subtitles', imageModel: 'Keyframe model', videoModel: 'Video model', videoRes: 'Video resolution',
    yes: 'yes', no: 'no', auto: 'per style', seconds: 's',
    logline: 'In one sentence', beats: 'Beats', presets: 'Style presets', pick: 'Use this style', picked: 'Your pick', current: 'Project style',
    imageLine: 'Image style', videoLine: 'Video style', palette: 'Palette', samples: 'Samples', notes: 'Notes',
    look: 'Look', fixed: 'Fixed details', noSheet: 'No sheet yet',
    shot: 'Shot', dur: 'Sec', size: 'Size', angle: 'Angle', movement: 'Camera', blocking: 'Who goes where', mover: 'What moves', transition: 'Into next', desc: 'Action',
    first: 'First frame', last: 'Last frame', sideBySide: 'Side by side', overlay: 'Overlay', difference: 'Difference', phone: 'Phone size',
    prompt: 'Video prompt', review: 'Reviewer', notReviewed: 'not reviewed yet', reviewOld: 'review is for an older version', estimate: 'estimate',
    takes: 'Takes', useTake: 'Use this take', using: 'In the cut', rendering: 'rendering…', failed: 'failed', noTakes: 'Not rendered yet.',
    noFinal: 'No cut yet.', history: 'Your decisions', noHistory: 'Nothing decided yet.',
    noteShot: 'Note on this shot', sendNote: 'Send note', sent: 'Sent to the agent', changed: 'This item changed while you were looking at it. Check it again.',
    refreshed: 'Updated', commentNeeded: 'Write what to change first.', budgetNeeded: 'Set a budget first.',
    seeMotion: 'The agent cannot see motion or hear sound. Watch and listen before you pick.',
    preset: 'Preset',
    keys: { settings: 'settings & budget', story: 'story', style: 'style', storyboard: 'storyboard', cast: 'character sheet', frames: 'keyframes of' },
    stage: {
      need_settings: 'Set the budget and confirm the settings to begin.',
      agent_writing: 'The agent is writing the {x}.',
      waiting_for_user: 'Waiting for you: {x}.',
      agent_revising: 'The agent is revising the {x} from your comments.',
      agent_drawing: 'The agent is drawing the keyframes of {x}.',
      in_review: 'A reviewer is checking {x}.',
      ready_to_render: 'Approved and ready to render: {x}.',
      rendering: 'Rendering: {x}.',
      cutting: 'The agent is checking the takes and cutting the film.',
      final_review: 'The cut is done and going through a final review.',
    },
  },
  zh: {
    tabs: { settings: '设置与预算', story: '故事', style: '画风', cast: '角色设定', storyboard: '分镜', frames: '首尾帧', clips: '视频片段', final: '成片', log: '记录' },
    status: { empty: '还没有内容', awaiting: '等你确认', approved: '已确认', rejected: '已打回', stale: '确认后又改过' },
    approve: '确认', reject: '打回', commentPh: '哪里要改？（打回时必填，确认时可不填）',
    youSaid: '你说过', budget: '预算（美元）', budgetHelp: '设好预算之前不会生成任何东西。每一次付费调用都会先对照它检查。',
    spent: '已用', of: '/', left: '剩余', noBudget: '还没设预算',
    length: '片长', aspect: '画幅', music: '配乐', subtitles: '字幕', imageModel: '首尾帧模型', videoModel: '视频模型', videoRes: '视频分辨率',
    yes: '要', no: '不要', auto: '按画风', seconds: '秒',
    logline: '一句话说清', beats: '情节', presets: '画风库', pick: '用这个画风', picked: '你选的', current: '本片画风',
    imageLine: '图片画风', videoLine: '视频画风', palette: '配色', samples: '样帧', notes: '备注',
    look: '长相', fixed: '固定细节', noSheet: '还没有设定图',
    shot: '镜头', dur: '秒', size: '景别', angle: '机位', movement: '运镜', blocking: '谁往哪走', mover: '什么在动', transition: '怎么接下一镜', desc: '动作',
    first: '首帧', last: '尾帧', sideBySide: '并排', overlay: '叠加', difference: '差异', phone: '手机大小',
    prompt: '视频提示词', review: '审核', notReviewed: '还没审核', reviewOld: '审核的是旧版本', estimate: '预估',
    takes: '版本', useTake: '用这一条', using: '成片用这条', rendering: '生成中…', failed: '失败', noTakes: '还没生成。',
    noFinal: '还没有成片。', history: '你的决定', noHistory: '还没有做过决定。',
    noteShot: '对这个镜头的意见', sendNote: '发送意见', sent: '已发给 agent', changed: '你看的时候这一项被改过了，请重新看一遍。',
    refreshed: '已更新', commentNeeded: '先写清楚哪里要改。', budgetNeeded: '先设预算。',
    seeMotion: 'agent 看不到动态、听不到声音。挑之前请自己看一遍、听一遍。',
    preset: '预设',
    keys: { settings: '设置与预算', story: '故事', style: '画风', storyboard: '分镜', cast: '角色设定图', frames: '首尾帧：' },
    stage: {
      need_settings: '先设好预算并确认设置，才能开始。',
      agent_writing: 'agent 正在写{x}。',
      waiting_for_user: '等你确认：{x}。',
      agent_revising: 'agent 正在按你的意见修改{x}。',
      agent_drawing: 'agent 正在画 {x} 的首尾帧。',
      in_review: '审核正在检查 {x}。',
      ready_to_render: '已确认、可以生成：{x}。',
      rendering: '正在生成：{x}。',
      cutting: 'agent 正在检查片段并剪辑成片。',
      final_review: '成片已剪好，正在做最后的审片。',
    },
  },
}
let lang = localStorageGet('director.lang') || (/^zh/i.test(navigator.language) ? 'zh' : 'en')
let tab = localStorageGet('director.tab') || 'settings'
let projectId = null
let single = true
let data = null
let lastJson = ''
let styles = []
const drafts = new Map() // textarea drafts survive re-renders
const modes = new Map() // keyframe compare mode per shot

function localStorageGet(k) { try { return localStorage.getItem(k) } catch { return null } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v) } catch { /* private mode */ } }
const t = () => T[lang]

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue
    if (k === 'class') el.className = v
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
    else if (k === 'value') el.value = v
    else el.setAttribute(k, v === true ? '' : v)
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)))
  return el
}
const fileUrl = (rel) => `/api/p/${encodeURIComponent(projectId)}/file?path=${encodeURIComponent(rel)}&t=${encodeURIComponent(TOKEN)}`
const money = (n) => (n == null ? '—' : `$${Number(n).toFixed(n < 1 ? 3 : 2)}`)

async function api(path, body) {
  const r = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: { 'X-Director-Token': TOKEN, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(j.error || `HTTP ${r.status}`), { status: r.status })
  return j
}
function toast(msg) {
  const el = document.getElementById('toast')
  el.textContent = msg
  el.classList.remove('hidden')
  clearTimeout(toast.t)
  toast.t = setTimeout(() => el.classList.add('hidden'), 2600)
}

// ─── data ────────────────────────────────────────────────────────────────────

async function boot() {
  const { single: s, projects } = await api('/api/projects')
  single = s
  const sel = document.getElementById('project')
  if (!projects.length) { document.getElementById('main').replaceChildren(h('p', { class: 'muted' }, 'No projects yet.')); return }
  projectId = (localStorageGet('director.project') && projects.find((p) => p.id === localStorageGet('director.project'))?.id) || projects[0].id
  if (!single) {
    sel.classList.remove('hidden')
    sel.replaceChildren(...projects.map((p) => h('option', { value: p.id }, p.title || p.id)))
    sel.value = projectId
    sel.onchange = () => { projectId = sel.value; localStorageSet('director.project', projectId); lastJson = ''; refresh() }
  }
  styles = (await api(`/api/styles?lang=${lang}`)).styles
  await refresh()
  setInterval(refresh, 3000)
}

// While the user is typing, a poll must not rebuild the page under their cursor:
// keep the new data and draw it when they leave the field.
let pendingRender = false
const editing = () => {
  const a = document.activeElement
  return !!a && /^(TEXTAREA|INPUT)$/.test(a.tagName) && document.getElementById('main').contains(a)
}
document.getElementById('main').addEventListener('focusout', () => {
  setTimeout(() => { if (pendingRender && !editing()) { pendingRender = false; render() } }, 0)
})

async function refresh(force) {
  try {
    const v = await api(`/api/p/${encodeURIComponent(projectId)}/view`)
    const s = JSON.stringify(v)
    if (!force && s === lastJson) return
    lastJson = s
    data = v
    if (!force && editing()) { pendingRender = true; return }
    render()
  } catch (e) { toast(e.message) }
}

async function decide(key, status, extra = {}) {
  const st = data.summary.approvals[key]
  const comment = (drafts.get(key) || '').trim()
  if (status === 'rejected' && !comment) return toast(t().commentNeeded)
  try {
    data = await api(`/api/p/${encodeURIComponent(projectId)}/decide`, { key, status, comment, hash: st.hash, ...extra })
    drafts.delete(key)
    lastJson = JSON.stringify(data)
    render()
    toast(t().sent)
  } catch (e) {
    if (e.status === 409) { toast(t().changed); await refresh(true) } else toast(e.message)
  }
}
async function pick(body) {
  try {
    data = await api(`/api/p/${encodeURIComponent(projectId)}/pick`, body)
    lastJson = JSON.stringify(data)
    render()
    toast(t().sent)
  } catch (e) { toast(e.message) }
}

// ─── pieces ──────────────────────────────────────────────────────────────────

function badge(status) { return h('span', { class: `badge ${status}` }, t().status[status] || status) }

function draftBox(key, placeholder) {
  return h('textarea', { placeholder: placeholder || t().commentPh, value: drafts.get(key) || '', oninput: (e) => drafts.set(key, e.target.value) })
}

function decision(key, { beforeApprove } = {}) {
  const st = data.summary.approvals[key]
  if (!st) return null
  const said = st.comment || st.last?.comment
  const empty = st.status === 'empty'
  return h('div', { class: 'decision' },
    h('div', { class: 'row between' }, badge(st.status), st.at ? h('span', { class: 'muted' }, new Date(st.at).toLocaleString()) : null),
    said ? h('div', { class: 'said' }, `${t().youSaid}: ${said}`) : null,
    empty ? null : draftBox(key),
    empty ? null : h('div', { class: 'row' },
      h('button', { class: 'primary', type: 'button', disabled: st.status === 'approved', onclick: () => (beforeApprove ? beforeApprove() : decide(key, 'approved')) }, t().approve),
      h('button', { class: 'danger', type: 'button', onclick: () => decide(key, 'rejected') }, t().reject)))
}

function versions(list, selected) {
  if (!list?.length || list.length < 2) return null
  return h('div', { class: 'versions' }, list.map((v) => h('a', { href: fileUrl(v.file), target: '_blank', rel: 'noopener', title: `v${v.version}` },
    h('img', { src: fileUrl(v.file), alt: `v${v.version}`, class: v.file === selected ? 'sel' : '' }))))
}

function img(rel, alt) { return rel ? h('a', { href: fileUrl(rel), target: '_blank', rel: 'noopener' }, h('img', { class: 'thumb', src: fileUrl(rel), alt })) : null }
function swatches(list) { return h('div', { class: 'swatches' }, (list || []).map((c) => { const s = h('span', { class: 'swatch', title: c }); s.style.background = /^#[0-9a-f]{3,8}$/i.test(c) ? c : 'transparent'; return s })) }

// ─── tabs ────────────────────────────────────────────────────────────────────

const VIEWS = {
  settings() {
    const p = data.project
    const s = p.settings
    const budgetKey = 'budget-input'
    const current = drafts.has(budgetKey) ? drafts.get(budgetKey) : (data.summary.budget.usd ?? '')
    const input = h('input', { type: 'number', min: '0', step: '0.5', value: current, oninput: (e) => drafts.set(budgetKey, e.target.value) })
    return [h('div', { class: 'card' },
      h('h2', {}, t().tabs.settings),
      h('dl', { class: 'kv' },
        h('dt', {}, t().length), h('dd', {}, `${s.length_s} ${t().seconds}`),
        h('dt', {}, t().aspect), h('dd', {}, s.aspect),
        h('dt', {}, t().music), h('dd', {}, s.music ? t().yes : t().no),
        h('dt', {}, t().subtitles), h('dd', {}, s.subtitles ? t().yes : t().no),
        h('dt', {}, t().imageModel), h('dd', {}, `${s.image_model} · ${s.image_resolution}`),
        h('dt', {}, t().videoModel), h('dd', {}, s.video_model || t().auto),
        h('dt', {}, t().videoRes), h('dd', {}, s.video_resolution)),
      h('div', { class: 'decision' },
        h('label', { class: 'row' }, h('strong', {}, t().budget), input),
        h('p', { class: 'muted' }, t().budgetHelp),
        data.summary.budget.remaining_shots_estimate ? h('p', { class: 'muted' }, `${t().estimate}: ${money(data.summary.budget.remaining_shots_estimate)}`) : null),
      decision('settings', {
        beforeApprove: () => {
          const v = Number(drafts.has(budgetKey) ? drafts.get(budgetKey) : data.summary.budget.usd)
          if (!(v > 0)) return toast(t().budgetNeeded)
          decide('settings', 'approved', { budget_usd: v })
        },
      }))]
  },

  story() {
    const st = data.project.story
    return [h('div', { class: 'card' },
      h('h2', {}, t().tabs.story),
      st.logline ? h('p', {}, h('strong', {}, `${t().logline}: `), st.logline) : null,
      st.text ? h('div', { class: 'pre' }, st.text) : h('p', { class: 'muted' }, t().status.empty),
      st.beats?.length ? h('div', {}, h('h3', {}, t().beats), h('ol', {}, st.beats.map((b) => h('li', {}, b)))) : null,
      decision('story'))]
  },

  style() {
    const s = data.project.style
    const chosen = data.summary.style_pick
    return [
      h('div', { class: 'card' },
        h('h2', {}, t().current),
        h('dl', { class: 'kv' },
          h('dt', {}, t().preset), h('dd', {}, s.preset || '—'),
          h('dt', {}, t().imageLine), h('dd', {}, s.image || '—'),
          h('dt', {}, t().videoLine), h('dd', {}, s.video || '—'),
          h('dt', {}, t().palette), h('dd', {}, swatches(s.palette)),
          s.notes ? h('dt', {}, t().notes) : null, s.notes ? h('dd', {}, s.notes) : null),
        s.selected?.length ? h('div', {}, h('h3', {}, t().samples), h('div', { class: 'grid' }, s.selected.map((f) => img(f, 'sample')))) : null,
        decision('style')),
      h('div', { class: 'card soft' },
        h('h2', {}, t().presets),
        h('div', { class: 'grid' }, styles.map((st) => h('div', { class: `card style-card ${chosen === st.id ? 'picked' : ''}` },
          h('div', { class: 'row between' }, h('strong', {}, st.name), chosen === st.id ? h('span', { class: 'badge approved' }, t().picked) : null),
          h('div', { class: 'muted' }, st.summary),
          swatches(st.palette),
          h('div', { class: 'muted mono' }, st.video_model),
          h('button', { class: 'ghost', type: 'button', disabled: chosen === st.id, onclick: () => pick({ kind: 'style', value: st.id }) }, t().pick))))),
    ]
  },

  cast() {
    const cast = data.project.cast
    if (!cast.length) return [h('div', { class: 'card' }, h('p', { class: 'muted' }, t().status.empty))]
    return [h('div', { class: 'grid two' }, cast.map((c) => h('div', { class: 'card' },
      h('h3', {}, c.name || c.id),
      h('dl', { class: 'kv' }, h('dt', {}, t().look), h('dd', {}, c.look || '—'), h('dt', {}, t().fixed), h('dd', {}, c.fixed || '—')),
      c.selected ? img(c.selected, c.name) : h('p', { class: 'muted' }, t().noSheet),
      versions(c.sheets, c.selected),
      decision(`cast:${c.id}`))))]
  },

  storyboard() {
    const shots = data.project.shots
    const cols = ['id', 'duration_s', 'size', 'angle', 'movement', 'blocking', 'mover', 'description', 'transition']
    const heads = [t().shot, t().dur, t().size, t().angle, t().movement, t().blocking, t().mover, t().desc, t().transition]
    return [h('div', { class: 'card' },
      h('h2', {}, t().tabs.storyboard),
      shots.length ? h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, heads.map((x) => h('th', {}, x)))),
        h('tbody', {}, shots.map((s) => h('tr', {}, cols.map((k) => h('td', {}, s[k] ?? '')))))))
        : h('p', { class: 'muted' }, t().status.empty),
      decision('storyboard'))]
  },

  frames() {
    const shots = data.project.shots
    if (!shots.length) return [h('div', { class: 'card' }, h('p', { class: 'muted' }, t().status.empty))]
    return shots.map((s) => {
      const sum = data.summary.shots.find((x) => x.id === s.id)
      const mode = modes.get(s.id) || 'side'
      const f = s.selected || {}
      let pic
      if (!f.first || !f.last) pic = h('p', { class: 'muted' }, t().status.empty)
      else if (mode === 'side') pic = h('div', { class: 'pair' }, h('figure', {}, img(f.first, 'first'), h('figcaption', {}, t().first)), h('figure', {}, img(f.last, 'last'), h('figcaption', {}, t().last)))
      else if (mode === 'phone') pic = h('div', { class: 'row' }, h('img', { class: 'thumb phone', src: fileUrl(f.first), alt: 'first' }), h('img', { class: 'thumb phone', src: fileUrl(f.last), alt: 'last' }))
      else {
        const top = h('img', { class: 'layer', src: fileUrl(f.last), alt: 'last' })
        top.style.opacity = mode === 'overlay' ? '0.5' : '1'
        pic = h('div', { class: `stack ${mode === 'diff' ? 'diff' : ''}` }, h('img', { src: fileUrl(f.first), alt: 'first' }), top)
      }
      const modeBtn = (m, label) => h('button', { class: mode === m ? 'primary' : 'ghost', type: 'button', onclick: () => { modes.set(s.id, m); render() } }, label)
      const review = sum?.review
      return h('div', { class: 'card' },
        h('div', { class: 'row between' }, h('h3', {}, `${t().shot} ${s.id}`), h('span', { class: 'muted mono' }, `${sum?.model} · ${sum?.resolution} · ${sum?.seconds}${t().seconds} · ${t().estimate} ${money(sum?.estimate)}`)),
        s.description ? h('p', {}, s.description) : null,
        h('div', { class: 'row' }, modeBtn('side', t().sideBySide), modeBtn('overlay', t().overlay), modeBtn('diff', t().difference), modeBtn('phone', t().phone)),
        pic,
        h('div', { class: 'row' }, versions(s.frames?.first, f.first), versions(s.frames?.last, f.last)),
        s.video_prompt ? h('div', {}, h('h3', {}, t().prompt), h('div', { class: 'prompt pre' }, s.video_prompt)) : null,
        h('p', {}, h('strong', {}, `${t().review}: `), review ? `${review.verdict}${review.current ? '' : ` (${t().reviewOld})`}` : t().notReviewed),
        review?.issues?.length ? h('ul', { class: 'issues' }, review.issues.map((x) => h('li', {}, x))) : null,
        decision(`frames:${s.id}`))
    })
  },

  clips() {
    const shots = data.summary.shots
    if (!shots.length) return [h('div', { class: 'card' }, h('p', { class: 'muted' }, t().status.empty))]
    return [h('div', { class: 'card soft' }, h('p', {}, t().seeMotion)), ...shots.map((s) => {
      const chosen = s.picked_take ?? s.takes.filter((x) => x.state === 'done').at(-1)?.take
      const noteKey = `note:${s.id}`
      return h('div', { class: 'card' },
        h('h3', {}, `${t().shot} ${s.id}`),
        s.takes.length ? h('div', { class: 'grid two' }, s.takes.map((tk) => h('div', { class: 'card soft' },
          h('div', { class: 'row between' }, h('strong', {}, `take ${tk.take}`), h('span', { class: 'muted' }, tk.state === 'done' ? money(tk.cost) : tk.state === 'submitted' ? t().rendering : t().failed)),
          tk.file ? h('video', { src: fileUrl(tk.file), controls: true, preload: 'metadata', playsinline: true }) : null,
          tk.error ? h('p', { class: 'muted' }, tk.error) : null,
          tk.state === 'done' ? h('button', { class: chosen === tk.take ? 'primary' : 'ghost', type: 'button', disabled: chosen === tk.take, onclick: () => pick({ kind: 'take', shot: s.id, value: tk.take }) }, chosen === tk.take ? t().using : t().useTake) : null)))
          : h('p', { class: 'muted' }, t().noTakes),
        h('div', { class: 'decision' }, draftBox(noteKey, t().noteShot),
          h('div', { class: 'row' }, h('button', { class: 'ghost', type: 'button', onclick: () => { const v = (drafts.get(noteKey) || '').trim(); if (!v) return toast(t().commentNeeded); drafts.delete(noteKey); pick({ kind: 'note', key: `shot:${s.id}`, value: v }) } }, t().sendNote))))
    })]
  },

  final() {
    const o = data.project.output
    return [h('div', { class: 'card' },
      h('h2', {}, t().tabs.final),
      o?.file ? h('div', {}, h('video', { src: fileUrl(o.file), controls: true, preload: 'metadata', playsinline: true }),
        h('p', { class: 'muted' }, `${o.file} · ${o.seconds}${t().seconds} · ${money(data.summary.budget.billed)}`),
        h('p', { class: 'muted' }, t().seeMotion))
        : h('p', { class: 'muted' }, t().noFinal))]
  },

  log() {
    const list = data.history
    return [h('div', { class: 'card' }, h('h2', {}, t().history),
      list.length ? h('ul', { class: 'log' }, list.map((x) => h('li', {}, `${new Date(x.at).toLocaleString()} · ${x.key} · ${x.status}${x.comment ? ` · ${x.comment}` : ''}`)))
        : h('p', { class: 'muted' }, t().noHistory))]
  },
}

/** "frames:s03" → "首尾帧：s03"; "cast:mia" → "角色设定图 mia". */
function keyLabel(key) {
  if (!key) return ''
  const [kind, id] = key.split(':')
  const k = t().keys
  if (kind === 'frames') return `${k.frames} ${id}`.replace('： ', '：')
  if (kind === 'cast') return `${k.cast} ${id}`
  return k[kind] || key
}
function stageText(stage) {
  const tpl = t().stage[stage?.code]
  if (!tpl) return ''
  const isKey = ['agent_writing', 'waiting_for_user', 'agent_revising'].includes(stage.code)
  return tpl.replace('{x}', isKey ? keyLabel(stage.arg) : (stage.arg || ''))
}

function stepStatus(name) {
  const a = data.summary.approvals
  const pickWorst = (keys) => {
    const sts = keys.map((k) => a[k]?.status).filter(Boolean)
    for (const s of ['rejected', 'awaiting', 'stale']) if (sts.includes(s)) return s
    if (sts.length && sts.every((s) => s === 'approved')) return 'approved'
    return ''
  }
  if (name === 'cast') return pickWorst(Object.keys(a).filter((k) => k.startsWith('cast:')))
  if (name === 'frames') return pickWorst(Object.keys(a).filter((k) => k.startsWith('frames:')))
  return a[name] ? pickWorst([name]) : ''
}

function render() {
  if (!data) return
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  document.getElementById('lang').textContent = lang === 'zh' ? 'English' : '中文'
  document.getElementById('title').textContent = data.project.title || 'Video Director'
  document.title = `${data.project.title || 'Video Director'} · Console`
  document.getElementById('next').textContent = stageText(data.summary.stage)
  const b = data.summary.budget
  const pct = b.usd > 0 ? Math.min(100, (b.committed / b.usd) * 100) : 0
  const bar = h('div', { class: `bar ${b.usd > 0 && b.committed > b.usd ? 'over' : ''}` }, h('span'))
  bar.firstChild.style.width = `${pct}%`
  document.getElementById('meter').replaceChildren(
    h('div', {}, b.usd > 0 ? `${money(b.committed)} ${t().spent} ${t().of} ${money(b.usd)} · ${t().left} ${money(b.left)}` : t().noBudget), bar)
  document.getElementById('steps').replaceChildren(...Object.keys(VIEWS).map((name) => {
    const st = name === 'log' || name === 'clips' || name === 'final' ? '' : stepStatus(name)
    return h('button', { class: tab === name ? 'on' : '', type: 'button', onclick: () => { tab = name; localStorageSet('director.tab', tab); render() } },
      st ? h('span', { class: `dot ${st}` }) : null, t().tabs[name])
  }))
  const y = window.scrollY
  document.getElementById('main').replaceChildren(...(VIEWS[tab] || VIEWS.settings)())
  window.scrollTo(0, y)
}

document.getElementById('lang').onclick = async () => {
  lang = lang === 'zh' ? 'en' : 'zh'
  localStorageSet('director.lang', lang)
  styles = (await api(`/api/styles?lang=${lang}`)).styles
  render()
}
boot().catch((e) => { document.getElementById('main').replaceChildren(h('p', { class: 'muted' }, e.message)) })
