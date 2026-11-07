# AI Video Director

[中文说明](README.zh-CN.md)

**AI Video Director is a Claude Code plugin and MCP server that turns one idea into a short AI film by treating every shot like a film set: the first and last frame of each shot are drawn and approved before the video model renders the motion between them.** Your agent (Claude Code, Codex or any MCP client) does the work — story, style, character sheets, storyboard, keyframes, Seedance renders, the cut — and you approve each step in a local review console before anything is paid for.

It is made by [apimodels.app](https://apimodels.app) and runs on one apimodels.app API key: the image models for keyframes and the Seedance models for shots go through the same key.

**Use it for** short films, animated shorts, music videos and ads of roughly 15 seconds to 3 minutes, built from separate shots, where how each shot looks matters.
**Do not use it for** lip-synced dialogue, one long continuous take, screen recordings, or anything showing a real, identifiable person who has not agreed to it.

## How it works

1. **Settings and budget** — you set length, aspect ratio and a budget in the console. Nothing paid runs before that.
2. **Story** — the agent develops your idea into a shot-by-shot story; a fresh reviewer reads it cold; you approve.
3. **Style** — pick from eleven presets (hand-drawn, crisp-line feature 2D, flat 2D, paper cut-out, cinematic, retro cartoon, anime cel, clay, ink wash, watercolour, pixel) or describe your own; approve sample frames.
4. **Characters** — one sheet per recurring character or prop, fixed details written with their side.
5. **Storyboard** — size, angle, camera move, blocking in screen directions, what moves, how each shot hands off; you approve.
6. **Keyframes** — first and last frame of every shot, made from each other so the camera and set carry over; free checks: a difference image between the two, push-in frames cropped from the wide one.
7. **Review and approval** — a fresh reviewer checks frames against the seven-block video prompt; you approve each shot in the console, where you can flip between side-by-side, overlay, difference and phone-size views.
8. **Render** — Seedance renders each shot from its two frames. Takes are kept; you pick one per shot.
9. **Cut** — trims, one size and frame rate, BT.709, 1080p upscale, optional music.

## What keeps the cost down

- **Paid calls are gated in code, not just in the instructions.** Each approval is bound to a hash of what you saw. If the agent changes the story, a frame or a prompt after you approved it, the approval no longer matches and the render is refused until you look again.
- **A budget you set.** Every image and every render is checked against it before it is sent; what the API really billed is read back after each task.
- **No double payment.** Task ids are saved the moment they exist; a timeout, a crash or a closed laptop resumes the same task instead of paying again.
- **Mistakes are caught where they cost least to fix.** Words before images, images before video; a fresh reviewer must pass every shot before it can be rendered.
- **Nothing is overwritten.** Every frame, take and cut is a new version.

## A real run

One shot, start to finish against the live API on 2026-11-06 (paper cut-out preset, 16:9):

| Step | Billed | Time |
|---|---|---|
| First frame, `gpt-image-2` 1K | $0.024 | 58 s |
| Last frame, cropped from the first for a push-in | free | <1 s |
| 4-second shot, `dreamina-seedance-2-0-mini` 480p, first + last frame | $0.0864 | 172 s |
| Cut to 1080p | free | 3 s |

![First and last keyframe of the shot](assets/example-first-last.jpg)

![A frame from the finished 1080p cut](assets/example-final.jpg)

## Install

You need Node.js 18+ and ffmpeg (`brew install ffmpeg`, `sudo apt install ffmpeg` or `winget install ffmpeg`).

### Claude Code (plugin: skill + MCP server + reviewer agents + `/director`)

```
/plugin marketplace add stimQQ/ai-video-director
/plugin install ai-video-director@ai-video-director
```

Then start a film with `/ai-video-director:director a paper boat survives a storm`.

### Codex

```bash
codex mcp add video-director -- npx -y github:stimQQ/ai-video-director mcp
npx skills add stimQQ/ai-video-director        # the video-director skill
```

Or in `~/.codex/config.toml`:

```toml
[mcp_servers.video-director]
command = "npx"
args = ["-y", "github:stimQQ/ai-video-director", "mcp"]
```

### Any other MCP client (Cursor, Windsurf, Claude Desktop, …)

Run `npx -y github:stimQQ/ai-video-director mcp` as a stdio MCP server, and give the agent [skills/video-director/SKILL.md](skills/video-director/SKILL.md).

### API key

```bash
npx -y github:stimQQ/ai-video-director login
```

One click in the browser authorizes this computer; the key is saved to `~/.apimodels/credentials` and never passes through the chat or your shell history. You can also set `APIMODELS_API_KEY`. Create keys at [apimodels.app/console/api-keys](https://apimodels.app/console/api-keys).

## The review console

The console opens when a project is created (`director_new`), or any time with:

```bash
npx -y github:stimQQ/ai-video-director console ./films
```

It runs on `127.0.0.1` only, checks the Host header, and every request needs a token that only the page it served knows. It never spends money and never edits the plan; it only records your decisions in `approvals.json`.

## Models and prices

| Job | Default | Notes |
|---|---|---|
| Keyframes, style samples, character sheets | `gpt-image-2` 1K (about $0.025 each) | `nano-banana-2-1` also supported |
| Stylised shots | `dreamina-seedance-2-0-mini` 480p, $0.0225 per second | Refuses frames that look like a real person |
| Photoreal people | `seedance-2.0-mini` 480p, $0.044 per second | |
| Hard motion | `seedance-2.5`, from $0.12 per second | Try the hardest shot alone first |

A 30-second stylised film of six 5-second shots is roughly $0.70 of video plus $0.30–0.60 of keyframes before retakes. List prices are on [apimodels.app/pricing](https://apimodels.app/pricing); failed tasks are not charged.

## MCP tools

| Tool | Paid | What it does |
|---|---|---|
| `director_new` | | Create a project and open the console |
| `director_status` | | Approvals, comments, budget, shots, next step |
| `director_save` | | Write settings, story, style, cast, storyboard or one shot |
| `director_console` / `director_wait` | | Console link; wait for your decision |
| `director_styles` | | The eleven style presets |
| `director_image` | ✓ | Style sample, character sheet, first or last frame |
| `director_import_image` | | Bring in an image made elsewhere |
| `director_derive_frame` | | Crop a push-in frame from the wide one |
| `director_compare` | | Side by side + difference image |
| `director_look` | | Show a project image to the agent |
| `director_review` | | Record the reviewer's verdict |
| `director_estimate` | | Price of the remaining shots |
| `director_render` | ✓ | Render a take from the two keyframes |
| `director_frames` | | Contact sheet, first and last frame of a take |
| `director_assemble` | | Cut, upscale, music |

## FAQ

**Why first and last frames instead of a text prompt?**
Because the expensive failures are compositional: the wrong framing, a prop that appears from nowhere, an ending that does not lead into the next shot. When both ends of a shot are fixed pictures, the model only has to move things between them, so far fewer renders are thrown away. Rain, hats and tattoos that exist only in a prompt tend to vanish mid-shot; drawn on both frames they stay.

**Can I use my own images or Codex's image tool?**
Yes. `director_import_image` brings any image in as a style sample, character sheet or keyframe, and it goes through the same checks and approvals.

**Can the agent skip my approval?**
Not through the tools: the paid tools check the approvals and the budget in code and refuse otherwise, and an approval stops counting as soon as the approved thing changes. The console writes approvals only when you click.

**Does the agent see the videos?**
It sees still frames — contact sheets and the first and last frame of each take — not motion, and it hears nothing. It is told to say so, and to ask you to watch and listen before picking takes.

## Development

```bash
pnpm test          # offline: fake API, real ffmpeg, real console over HTTP, MCP over stdio
pnpm run mutate    # breaks each guard on purpose and checks a test fails
```

## License

MIT © apimodels.app
