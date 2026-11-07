---
name: video-director
description: Direct a short AI film from an idea to a finished cut — story, visual style, character sheets, storyboard, a first and last keyframe for every shot, Seedance renders and the edit — with the user approving each step in a local review console before anything is paid for. Use when the user wants to make an AI short film, animated short, music video or ad from Claude Code or Codex and cares about how every shot looks; also when they ask how to get fewer failed video generations ("抽卡"), how to keep shots consistent, or how to control camera moves in AI video. Needs the video-director MCP server (bundled with this plugin) and one apimodels.app API key.
---

# Video Director

**Video Director turns one idea into a short AI film by treating every shot like a film set: the frame it starts on and the frame it ends on are drawn and approved first, and the video model only fills in the motion between them.** You are the director. The user decides; the review console is where they do it. Every image and every video goes through the apimodels.app API with one key.

Use it for films of roughly 15 seconds to 3 minutes made of separate shots. Do not use it for lip-synced dialogue, a single long take, live screen recordings, or anything showing a real, identifiable person who has not agreed to it.

## The rules that do not bend

1. **The user approves; you never approve for them.** Settings and budget, story, style, each character sheet, the storyboard and each shot's keyframes are approved in the console. The paid tools check this in code. When a tool says *Not allowed yet*, call `director_wait` and tell the user what is waiting; never look for a way around it, and never write `approvals.json`.
2. **Catch mistakes where they cost least to fix.** A word costs nothing to change, an image costs cents, a video costs dimes per second. Find the problem in the text before drawing it; find it in the keyframes before rendering them.
3. **Money stops at the budget.** Nothing paid runs before the user sets a budget. Never top up or buy credits. On *Not enough balance*, stop, cut what is already rendered and show it.
4. **Keep everything.** Tools write new versions next to old ones; do the same with any file you make. An old take may turn out to be the best one.
5. **Say what you cannot check.** You see still frames, not motion, and you hear nothing. Every report on a video says so, and asks the user to watch and listen.
6. **Fix before re-rendering.** A bad clip is first a trimming or post-production problem. Re-render only that one shot, and only after changing what caused the problem — the same input fails the same way.

## Setup check

`director_new` reports whether an API key and ffmpeg are present. Without a key, give the user this to run in their own terminal (never ask them to paste a key into the chat):

```
npx -y github:stimQQ/ai-video-director login
```

## The workflow

| Step | What you do | Tools | Then |
|---|---|---|---|
| 0 Kick-off | Ask for length, aspect ratio, budget, music, subtitles, any reference film. | `director_new` | User sets budget and confirms settings in the console |
| 1 Story | Develop the idea with the user into a shot-by-shot story. Rules: [references/story.md](references/story.md). Have a fresh reviewer read only the story. | `director_save` story | User approves |
| 2 Style | Offer 2–3 presets that fit. The user can also pick one in the console (`style_pick` in status). Save the style, draw one or two sample frames. | `director_styles`, `director_save` style, `director_image` kind=style | User approves |
| 3 Sheets | For every recurring character or key prop: front, side and a few expressions on one sheet; write fixed details with their side ("scar over the LEFT eyebrow"). | `director_save` cast, `director_image` kind=cast | User approves each |
| 4 Storyboard | One row per shot: duration, size, angle, camera, who goes where (screen left/right), what moves, how it hands off to the next shot, and what the first and last frames show. Rules: [references/shots.md](references/shots.md). | `director_save` storyboard | User approves |
| 5 Keyframes | Draw the busier frame first (usually the last), then make the other from it. Check both. Rules: [references/keyframes.md](references/keyframes.md). | `director_image` kind=last/first with `refs`, `director_derive_frame`, `director_compare`, `director_look` | — |
| 6 Video prompt | Seven blocks, second by second. [references/video-prompt.md](references/video-prompt.md). | `director_save` shot | — |
| 7 Review | A fresh reviewer checks frames + prompt; record the verdict. Briefs: [references/review-briefs.md](references/review-briefs.md). | `director_review` | Fix and repeat until pass |
| 8 Approval | Tell the user which shots are ready and what each will cost. | `director_estimate`, `director_wait` | User approves each shot's keyframes |
| 9 Render | Render shot by shot. If it says pending, call it again for the same shot — it resumes, it does not pay again. | `director_render` | — |
| 10 Check | Contact sheet + start/end frames of every take; compare the end with the planned last frame. | `director_frames`, `director_look` | User watches, picks takes |
| 11 Cut | Trim, cut, upscale, music. Then a fresh first-time viewer reviews the cut. [references/post.md](references/post.md). | `director_assemble` | Report to the user |

`director_status` always tells you where the project stands, what the user said and the next step. Read it at the start of every session and whenever you are unsure.

## Fresh reviewers

You have been talking with the user for a long time, so you fill gaps in your own work without noticing. A reviewer that has seen nothing else does not. Give it only the files the brief lists — never your conclusions — and ask it only to find problems, never to edit.

- **Claude Code:** use the bundled agents: `shot-reviewer` before every render, `first-viewer` for the story and the final cut, `brief-keeper` to check nobody forgot something the user asked for.
- **Codex or other clients:** start a separate session for the review (for Codex: `codex exec` with the brief and the file paths), or, if that is not possible, do a separate pass that reads only the listed files, and tell the user the review was not independent.

## Choosing models

| Job | Default | When to change |
|---|---|---|
| Keyframes and sheets | `gpt-image-2` at 1K | `nano-banana-2-1` is slightly more affordable; use 2K only for fine detail |
| Stylised shots (2D, anime, paper, clay, ink, pixel) | `dreamina-seedance-2-0-mini` 480p | It refuses frames that look like a real person |
| Photoreal people | `seedance-2.0-mini` 480p | — |
| Hard motion (several people interacting, fast action) | `seedance-2.5` | About five times the price of the mini lines; try the hardest shot alone first |

Render at 480p and let the cut upscale to 1080p. List prices are in `director_estimate`; what was really billed is read back after every task and that is what the budget counts. A 30-second film of six 5-second stylised shots is roughly $0.70 of video plus $0.30–0.60 of keyframes before any retakes.

## Talking to the user

Use their language. Keep reports short: what is ready to look at, the console link, what each next step costs, and what you could not check. When you need a decision, say exactly which tab of the console it is in.
