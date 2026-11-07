# Rendering, fixing and the edit

**Every second of video costs money and every edit costs nothing, so a bad clip goes to the edit first and back to the model last.**

## Rendering

- Render at 480p; the cut upscales to 1080p. 720p only for the final take of a shot that needs fine detail.
- No test renders: the first render of a real shot is the test, and if it works you keep it.
- New approach or a new model? Try the one or two hardest shots first; render the rest when those work.
- `seedance-2.5` costs about five times the mini lines. Use it for shots with several people interacting or fast action; everything simpler is fine on a mini line.
- Listen before you use a clip's own sound. The mini lines' effects are often usable as they are; Seedance 2.5 sometimes mixes in music even when told not to — drop that audio and lay sound in the edit.
- A render that returns *pending* is still running upstream. Call `director_render` for the same shot again; it waits for the same task.

## When a take has a problem

Ask in this order:

1. **Can it be cut?** Problems in the first or last few frames: trim them (`trims` in `director_assemble`).
2. **Can code fix it?** Write the ffmpeg for it: a slow crop to strengthen a push-in, a freeze frame over a jump at the end, a colour match back to the clip's first frame, a short dissolve over a flicker.
3. **Only then re-render** — just this shot, with `new_take: true`, and only after changing the prompt or the keyframes, because the same input fails the same way. Keep the old take: the new one is not always better, and the user picks in the console.

## The cut

`director_assemble` handles the plumbing: the user's picked takes (else the latest), trims, one size, 24 fps, stereo 48 kHz, untagged clips read as BT.601 and delivered converted to and tagged BT.709, lossless-quality intermediates, 1080p lanczos upscale with a light sharpen, an optional music bed. Every cut is a new version.

What it does not do, and you write in ffmpeg when the film needs it:

- **Transitions:** prefer cuts motivated by the action, or something crossing the lens that covers the cut. For motion blur across a whip transition, blend 8–16 sub-frames with a half-frame shutter.
- **Grade by story section:** adjust saturation and brightness only, never hue; protect the accent colour and skin tones; no grain, glow or vignette unless the user asks.
- **Beat sync:** measure the beats on the original music file, never on an edited one, then retime cuts to them.
- **No frame interpolation over whole clips** — it smears faces.

After any cut, pull the three frames before and after every cut point and look at them.

## Final review and hand-over

A fresh first-time viewer watches the cut with the final brief in [review-briefs.md](review-briefs.md). Fix the hard errors, list the small ones for the user, and write down what nobody could check (motion feel, sound).

Then save the project notes for next time in the project folder: the style lines that worked, prompts that worked, every mistake and its fix.
