# Designing the shots

**The storyboard decides whether the film looks directed or generated: a good story shot from eye level, dead centre, with nothing moving, still looks like a slideshow.** Composition and colour matter at least as much as plot.

If the user has a reference film, look at it frame by frame and measure what you see — where the camera sits, how much of the frame a person fills when they enter and leave, how long each shot holds — then borrow those numbers. Without one, design from the rules below.

Save with `director_save` section `storyboard`, one object per shot:

| Field | What to write |
|---|---|
| `id` | `s01`, `s02`, … |
| `duration_s` | Time on screen, rounded **up** to a whole second, plus about half a second spare for trimming (4–15 s per shot) |
| `size` | Wide, full, medium, close-up, extreme close-up |
| `angle` | Eye level, low, high, from behind, over the shoulder, through something (a doorway, leaves, a window frame) |
| `movement` | Static, push in, pull out, pan, follow, … — and why |
| `blocking` | Who goes where, in screen directions: "enters from frame left, stops at the right third" |
| `mover` | The one thing that carries the shot's motion (see 3) |
| `description` | The action, with the expression that drives it |
| `first_plan` / `last_plan` | What the first and the last frame show — written before anything is drawn |
| `transition` | How this shot hands off to the next |

## Seven rules

1. **Change the angle every shot.** At most two straight-on, eye-level shots in the whole film; the rest are low, high, from behind, over the shoulder or through something.
2. **Something is always moving.** In most shots a person or object enters or leaves the frame. If the subject stays put, give the frame something else: a passer-by behind them, a leaf drifting through, steam, a curtain. A locked-off camera needs this most — have the subject walk from far to near.
3. **Name the mover.** Before writing a shot, answer: what moves here? The camera, the focus shifting between two people, the light, something crossing the lens, or a small gesture like trembling fingers. At least one. If you cannot name it, the shot is not designed yet. And not everything at once: quiet shots make the moving ones count.
4. **Move the camera for a reason.** Three reasons cover most shots: follow something (a letter blowing down the street), push in to show a reaction, or start close and pull back to reveal where we are.
5. **Vary the shot size.** Never three full-body shots in a row; alternate wide, medium and close.
6. **Every frame is a still worth keeping.** Put the eyes or the head on a vertical third — about 38 % or 62 % across the frame — not the centre. Leave head room and room in the direction of travel.
7. **Plan colour before the first image.** Agree the palette with the user, then write a colour script: one line per scene with its dominant colours and its one accent. Check it in grayscale too: if the subject and the background merge when colour is removed, the contrast is too weak — fix the palette, not the frames.

## Check before asking for approval

- Every shot has a mover, a reason for its camera move, and screen directions for its blocking.
- No run of three same-size shots; at most two eye-level frontal shots.
- First and last frame are described for every shot.
- Total duration matches the target length (and the music, if any).
