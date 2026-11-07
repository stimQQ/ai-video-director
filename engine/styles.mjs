/**
 * Visual style presets. A preset is a starting point, not a cage: the agent copies
 * it into the project, the user tunes it in the console, and from then on the
 * project's own `style` block is what every image and shot prompt uses.
 *
 *   image   — goes at the top of every keyframe / character-sheet prompt
 *   video   — the one-line [Style] block of every shot prompt
 *   palette — default colour script anchors (hex), replaced by the project's own
 *   video_model — the most cost-efficient line that does this look well (see engine/api.mjs)
 *   watch   — what tends to go wrong in this look, for the reviewer
 *
 * Names describe the look, never a studio, a film or a living artist.
 */

export const STYLES = [
  {
    id: 'warm-handdrawn',
    name: { en: 'Warm hand-drawn animation', zh: '温暖手绘动画' },
    summary: { en: 'Painted backgrounds, soft light, gentle character animation.', zh: '手绘背景、柔和光线、角色动作温和。' },
    image: 'Hand-drawn 2D animation still: painterly gouache backgrounds with visible brush texture, clean ink outlines on characters, soft warm daylight, gentle colour transitions, cinematic composition.',
    video: 'Hand-drawn 2D animation, painterly gouache backgrounds, clean character outlines, soft warm light. Style, colours and character design stay identical to the first and last frames.',
    palette: ['#F2E3C6', '#8DB580', '#4F7CAC', '#E59A5B', '#3B3B3B'],
    video_model: 'dreamina-seedance-2-0-mini',
    watch: { en: 'Clouds and plants grow faces; background repaints drift between frames.', zh: '云和植物容易长出五官；背景笔触在首尾帧之间漂移。' },
  },
  {
    id: 'crisp-feature-2d',
    name: { en: 'Crisp-line feature 2D', zh: '硬朗线条 2D 动画电影' },
    summary: { en: 'Feature-film 2D: crisp angular lines and sharp-jawed characters, flat colour with soft shadows, blurred painted backgrounds, cool blue-grey with one warm accent.', zh: '2D 动画电影质感：线条干脆有棱角，人物下颌硬朗，平涂加一层柔和阴影，背景虚化，蓝灰冷调里只留一处暖色。' },
    image: '2D hand-drawn digital animation still, flat 2D illustration (not 3D, not a CGI render). Crisp, confident dark-brown ink lines: straight segments that meet at sharp corners, tapered pointed line ends, no wobble. Angular, graphic Western 2D feature-film character design with semi-realistic proportions: slender figures with long necks, sharp angular jawlines and pointed chins, chiselled cheekbones, straight nose bridges with an angular tip, long narrow faces on men, straight lines set against curves, very large, round, wide-open eyes with coloured irises and plenty of white showing, a bold sharp upper lash line and a visible eyelid crease, thick angular eyebrows, small defined lips, strong rosy blush across the cheeks, nose and ears; hair drawn as soft masses with many fine flyaway strands. Exaggerated, theatrical facial expressions as in feature animation: wide-eyed reactions, open mouths, high-arched brows, flushed cheeks. Not chibi and not a kids\' TV cartoon: no rounded soft jaws, no bulbous noses, no dot eyes, no narrow or half-closed eyes, no oversized heads, not anime. Skin with soft warm gradient shading; clothes in flat colour with one soft-edged shadow tone; no fabric texture, no hatching, no sketchy lines. Softly painted background, simplified and blurred with atmospheric haze so the characters stand out. Cool overcast blue-grey palette with a single warm mustard-yellow accent.',
    video: '2D hand-drawn feature animation (not 3D), angular slender characters with sharp jaws, pointed chins, very large expressive eyes, exaggerated expressions and rosy blush, crisp tapered outlines, flat cel colour with soft-edged shadows, softly blurred painted backgrounds, cool blue-grey palette with one warm mustard accent. Style, colours and character design stay identical to the first and last frames.',
    palette: ['#ADBBCE', '#58677B', '#34425A', '#E0A53A', '#E09C77'],
    video_model: 'dreamina-seedance-2-0-mini',
    watch: { en: 'Slides into a 3D CG render with fabric texture; jaws and chins round off into soft shapes; lines turn scratchy and sketchy; faces drift toward kids\'-cartoon designs (bulbous noses, dot eyes) or anime; eyes shrink and expressions go flat; the blurred background sharpens into detail; the warm accent leaks onto other objects.', zh: '容易变成带布料质感的 3D 渲染；下巴和下颌被画圆、变软；线条变得毛糙、像草稿；脸容易画成低龄卡通（大鼻头、豆豆眼）或日系动漫；眼睛变小、表情变平淡；虚化的背景变成清晰细节；暖色强调色蔓延到别的物体上。' },
  },
  {
    id: 'clean-flat-2d',
    name: { en: 'Clean flat 2D', zh: '干净现代 2D 平涂' },
    summary: { en: 'Flat colour blocks, crisp lines, no texture. Reads well on phones.', zh: '平涂色块、利落线条、没有纹理，手机上看得清。' },
    image: 'Modern flat 2D animation still: solid colour fills, crisp uniform outlines, no grain, no texture, no gradients except soft cast shadows, strong silhouettes.',
    video: 'Clean modern 2D animation, flat colour fills, crisp lines, no grain or texture. Style, colours and character design stay identical to the first and last frames.',
    palette: ['#FFFFFF', '#1F2A44', '#F4B942', '#E4572E', '#76B041'],
    video_model: 'dreamina-seedance-2-0-mini',
    watch: { en: 'Line weight changes mid-shot; flat fills pick up gradients.', zh: '线条粗细在镜头中途变化；平涂色块被加上渐变。' },
  },
  {
    id: 'paper-cutout',
    name: { en: 'Paper cut-out', zh: '剪纸 / 纸偶' },
    summary: { en: 'Layered cut paper with real depth and soft shadows between layers.', zh: '多层剪纸，层与层之间有真实的厚度和柔和阴影。' },
    image: 'Layered paper cut-out animation still: matte coloured card stock, visible paper fibres and cut edges, soft drop shadows between layers, shallow depth of field, tabletop scale.',
    video: 'Layered paper cut-out animation, matte card stock with cut edges and soft shadows between layers, movement is slightly stepped like stop-motion. Identical to the first and last frames in style and colour.',
    palette: ['#EADBC8', '#C8553D', '#588B8B', '#F28F3B', '#2D3047'],
    video_model: 'dreamina-seedance-2-0-mini',
    watch: { en: 'Paper turns into plastic when it bends; layers merge.', zh: '纸片一弯就变成塑料质感；图层之间粘在一起。' },
  },
  {
    id: 'cinematic-real',
    name: { en: 'Cinematic live action', zh: '电影写实' },
    summary: { en: 'Looks shot on a cinema camera. Use the line that accepts realistic faces.', zh: '像电影机实拍。写实人脸要用接受真人脸的视频线。' },
    image: 'Photorealistic cinematic film still, shot on a large-sensor cinema camera, natural skin texture, motivated practical lighting, shallow depth of field, subtle film grain.',
    video: 'Photorealistic live-action footage, cinema camera look, natural motion and skin texture. Lighting, colour and faces stay identical to the first and last frames.',
    palette: ['#1B1F2A', '#C9A27E', '#5D7380', '#E8E2D6', '#8C2F39'],
    video_model: 'seedance-2.0-mini',
    watch: { en: 'Faces drift between frames; hands holding small objects break.', zh: '人脸在首尾帧之间走样；手拿小物件容易崩。' },
  },
  {
    id: 'retro-cartoon',
    name: { en: 'Retro cartoon', zh: '复古美式卡通' },
    summary: { en: 'Bouncy hand-inked characters, rounded shapes, saturated primaries.', zh: '弹性十足的手绘线条角色，圆润造型，高饱和原色。' },
    image: 'Retro hand-inked cartoon still: bold black outlines with slight wobble, rounded bouncy character shapes, saturated primary colours, simple painted backgrounds.',
    video: 'Retro hand-inked cartoon, bold wobbly outlines, rounded bouncy shapes, saturated primaries, squash-and-stretch motion. Same design and colours as the first and last frames.',
    palette: ['#F6E7C1', '#D62828', '#F77F00', '#003049', '#FCBF49'],
    video_model: 'dreamina-seedance-2-0-mini',
    watch: { en: 'Squash-and-stretch overshoots into body horror.', zh: '挤压拉伸做过头，身体变形。' },
  },
  {
    id: 'anime-cel',
    name: { en: 'Anime cel shading', zh: '日系赛璐璐动画' },
    summary: { en: 'Two-tone cel shadows, clean line art, expressive eyes.', zh: '两阶赛璐璐阴影、干净线稿、有神的眼睛。' },
    image: 'Anime key frame: clean line art, two-tone cel shading with crisp shadow shapes, expressive eyes, detailed painted background, cinematic framing.',
    video: 'TV anime, clean line art, crisp two-tone cel shading, detailed painted backgrounds. Character design and colours identical to the first and last frames.',
    palette: ['#EAF2F8', '#2E4057', '#F2A541', '#D1495B', '#66A182'],
    video_model: 'dreamina-seedance-2-0-mini',
    watch: { en: 'Eyes change shape between frames; hair colour shifts under new light.', zh: '眼型在首尾帧之间变化；换光后发色偏移。' },
  },
  {
    id: 'clay-3d',
    name: { en: 'Clay stop-motion', zh: '3D 黏土定格' },
    summary: { en: 'Handmade clay figures on a miniature set, visible fingerprints.', zh: '手工黏土人偶和微缩布景，看得见指纹。' },
    image: 'Clay stop-motion still: handmade plasticine figures with visible fingerprints and tool marks, miniature practical set, warm softbox lighting, macro lens depth of field.',
    video: 'Clay stop-motion animation, plasticine figures with fingerprints, miniature set, slightly stepped motion. Identical to the first and last frames in look and colour.',
    palette: ['#F4D35E', '#EE964B', '#F95738', '#0D3B66', '#FAF0CA'],
    video_model: 'dreamina-seedance-2-0-mini',
    watch: { en: 'Clay turns glossy CGI; motion gets too smooth to read as stop-motion.', zh: '黏土变成光滑 CG；动作太顺滑，不像定格。' },
  },
  {
    id: 'ink-wash',
    name: { en: 'Ink wash', zh: '水墨国风' },
    summary: { en: 'Brush ink on rice paper, lots of empty space, a single accent colour.', zh: '宣纸水墨，大量留白，只用一种强调色。' },
    image: 'Chinese ink wash painting style: expressive brush strokes, ink bleeding into textured rice paper, generous negative space, muted greys with one vermilion accent.',
    video: 'Animated ink wash painting, brush strokes and ink bleeding on rice paper, generous empty space, muted greys with one vermilion accent. Same look as the first and last frames.',
    palette: ['#F5F1E8', '#2B2B2B', '#8A8A8A', '#B23A2B', '#D8D2C4'],
    video_model: 'dreamina-seedance-2-0-mini',
    watch: { en: 'Ink turns into solid digital fills; the accent colour spreads everywhere.', zh: '水墨变成死板的电脑平涂；强调色到处蔓延。' },
  },
  {
    id: 'watercolor-storybook',
    name: { en: 'Watercolour storybook', zh: '水彩绘本' },
    summary: { en: 'Loose watercolour washes and pencil lines, like a picture book page.', zh: '松弛的水彩晕染加铅笔线，像绘本内页。' },
    image: 'Children\'s picture book illustration: loose watercolour washes, visible pencil sketch lines, white paper showing through, soft pastel palette, gentle light.',
    video: 'Animated watercolour storybook, loose washes and pencil lines on textured paper, soft pastel palette. Same look and colours as the first and last frames.',
    palette: ['#FFF8F0', '#9BC1BC', '#F4F1BB', '#ED6A5A', '#5D576B'],
    video_model: 'dreamina-seedance-2-0-mini',
    watch: { en: 'Washes get muddy as the shot goes on; paper texture disappears.', zh: '晕染越到后面越脏；纸张纹理消失。' },
  },
  {
    id: 'pixel-art',
    name: { en: 'Pixel art', zh: '像素风' },
    summary: { en: 'Low-resolution sprites and tiles, limited palette, hard edges.', zh: '低分辨率像素角色和场景，有限色板，硬边。' },
    image: 'Pixel art game scene: crisp hard-edged pixels, limited 16-colour palette, no anti-aliasing, no blur, tile-based background, side or three-quarter view.',
    video: 'Pixel art animation, crisp hard-edged pixels, limited palette, no blur or anti-aliasing, frame-by-frame sprite motion. Same look as the first and last frames.',
    palette: ['#1A1C2C', '#5D275D', '#B13E53', '#EF7D57', '#FFCD75'],
    video_model: 'dreamina-seedance-2-0-mini',
    watch: { en: 'Pixels soften into blur when the camera moves. Prefer a fixed camera.', zh: '镜头一动像素就糊成模糊；尽量用固定机位。' },
  },
]

export const styleById = (id) => STYLES.find((s) => s.id === id) || null

export function listStyles(lang = 'en') {
  const l = /^zh/i.test(lang) ? 'zh' : 'en'
  return STYLES.map((s) => ({ id: s.id, name: s.name[l], summary: s.summary[l], palette: s.palette, video_model: s.video_model, watch: s.watch[l] }))
}
