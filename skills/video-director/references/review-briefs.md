# Briefs for fresh reviewers

**A reviewer is only useful if it knows less than you: give it the files listed, nothing you concluded, and ask it to find problems — never to fix them.** Paste the brief, then the file paths. In Claude Code the bundled agents (`first-viewer`, `shot-reviewer`, `brief-keeper`) already carry these briefs; pass them the paths.

## Story — before the storyboard

```
You are reading a shot-by-shot story for a short film for the first time. Find problems only; do not edit any file.
Material: <path to director.json — read only the "story" section>
1. Read the shots in order, then retell the story in your own words as you understood it.
2. For every turn ask: why does this happen, where does this object come from, can they reach it, would this happen in real life?
3. Can you say in one sentence what the film is about?
4. Does the opening grab attention? Is the strongest image at the front?
5. Do bystanders react like real people, one after another rather than all at once?
6. Which moments will a video model probably get wrong? (people crossing, small objects in hands, readable text, mirrors and reflections, features that differ left and right, light changing within a shot, one person doing three things, top-down shots hiding the face, too many extras)
For each problem: shot, problem, suggested change. Mark guesses as "maybe". End with PASS or FAIL.
```

## Shot — before every paid render

```
You are the reviewer for one shot that is about to be rendered with real money. Read only; change nothing.
Material: <first frame>, <last frame>, <difference image from director_compare>, <character sheets>, <director.json: this shot's storyboard row and video_prompt, the style block, the shots before and after>
Check at full size:
1. Does every sentence of the prompt match both frames? Positions, left/right, colours, number of people, props and their count, clothes, expressions.
2. Do the two frames share camera position, scale and background? In the difference image, is everything that should stay the same black?
3. Do they match the character sheets, the palette and the neighbouring shots?
4. Is the action physically possible? Is the cause of every movement written down? Where are the hands?
5. Where could the model go wrong: things happening at the same moment, something appearing from nowhere, faces on objects, walking the wrong way, a phrase that can be read two ways?
End with exactly PASS or FAIL. For FAIL, list every change needed.
```

Record the result with `director_review` (`pass` / `fail` and the issues). A render needs a `pass` for the shot exactly as it is now.

## Final cut — before reporting to the user

```
This is a finished short film: <path>. You are watching it for the first time and know nothing about it.
1. Extract several full-resolution frames from every shot, and the 3 frames on each side of every cut.
2. Retell the story you understood, then list what you did not understand.
3. Shot by shot look for: repeated actions, prop counts changing, continuity errors, sudden jumps, colour jumps, warped faces, text artefacts.
4. State plainly what you cannot check (the feel of the motion, the sound).
For each finding: time, frame, problem. Split into HARD ERRORS and MINOR.
```

## Requirements keeper — at any step

```
Read everything the user has said in this project (the conversation and the console history in director.json / approvals.json). List every requirement and preference as a checklist.
Then check the current state of the project against it and report anything forgotten or contradicted, with where it shows. Do not edit anything.
```
