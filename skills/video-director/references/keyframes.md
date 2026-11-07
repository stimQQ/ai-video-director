# First and last keyframes

**Drawing the first and the last frame of every shot is what keeps retakes rare: the video model no longer has to invent the composition, the props or the ending — it only moves things from one picture to the other.** Anything that only exists in words (rain, a hat, a tattoo) tends to vanish halfway through a shot; anything drawn on both frames stays.

## Order of work

1. **Plan in words first.** For each shot write `first_plan` and `last_plan` in the storyboard: what is in frame, where, in what state, and what happens in between. Have the reviewer read these before you draw anything — a wrong plan caught here costs nothing.
2. **Draw the busier frame first** — usually the last, where everything has arrived. `director_image` kind `last`, with the character sheets in `refs`.
3. **Make the other frame from it.** `director_image` kind `first` with the last frame in `refs` and a prompt that describes only what differs. The camera, the set and the light carry over because the model edits instead of redrawing.
4. **Reuse set-ups.** Shots from the same place and camera position start from the previous shot's frame (`refs`), not from scratch.
5. **Push-ins and pull-outs:** if the camera moves in, draw the wide frame and cut the tighter one out of it with `director_derive_frame` (free) — `zoom` 1.1–1.4, `cx`/`cy` on the subject. Identical first and last frames give a shot with no camera move.
6. **Your own image tool works too.** Images made elsewhere (Codex's image tool, the user's own files) come in with `director_import_image`; then the same checks apply.

## Check every pair before review

Look at each frame with `director_look` at full size, and at the pair with `director_compare` (first | last | difference).

1. **Props needed later are already there.** If someone picks up a cup in second 3, the cup is on the table in the first frame — otherwise it appears from nowhere.
2. **Reactions are staged in advance.** A shot cannot cut away to the bystander, so place them in the first frame already: lead in front doing the thing, the other person behind, face towards camera.
3. **No two people in the same pose.** Matching poses make the model move them in unison.
4. **Room for the motion.** Where something will land or drift to is empty in the first frame; there is head room for a character who stands up.
5. **One wind.** Scarf, hair, smoke and curtains all blow the same way in both frames.
6. **Readable on a phone.** Shrink it to phone size (the console has a phone view): a distant figure that disappears at that size needs to be bigger.
7. **Nothing extra.** At full size, look for an extra chair, a sixth finger, a stray thin line, a doubled lamp.
8. **What should not change, does not change.** In the difference panel, the walls, the furniture and every object that stays put are black. A wall that changes tone becomes a wall that slowly changes colour in the video; a cup that is 10 % larger becomes a cup that grows.

Both frames end up exactly the project's aspect ratio — `director_render` crops them to it — so check that cropping to the aspect does not cut off anything that matters.

## Fixing a frame

- Describe only the change and pass the current frame as a reference.
- An image model re-renders the whole picture even for a small fix, so details elsewhere can drift. After a local fix, run `director_compare` with `a` = the previous version and `b` = the new one, and if anything outside the fix moved, cut the fixed region in and keep the rest of the old frame (ffmpeg `overlay` with a crop), then `director_import_image` the result.
- Every attempt is a new version; switch the selected one with `director_save` section `shot` `selected: {first, last}`.
