# The video prompt

**When a shot comes back wrong, suspect the prompt before the model: most errors are a sentence that could be read two ways, a cause that was never stated, or a moment nobody wrote down.** Write every shot in the same seven blocks and account for every second.

Save it with `director_save` section `shot` `{ id, video_prompt }`. The user sees it in the console next to the two frames and approves them together.

## The seven blocks

```
[Style] <one line: the project's video style>. Look, colours and character design match the first and last frames exactly.
[Camera] <N> seconds, <shot size>, <angle>, <move — or: locked off, no push, no pan, no cut>.
[Composition] <where each person and object sits in frame, screen left / right; wall and light colours> — as in the first frame.
[People] <each person: face, hair, clothes, fixed props and details with their side>. They stay exactly like this.
[Timing]
0–0.2 s: still, identical to the first frame.
<a–b s>: <who does what, which way they move in screen terms, what their hands do and must not touch, how the expression changes>.
last 0.3 s: everyone holds still; the frame is identical to the last frame.
[Sound] Only <sounds whose source is visible>. Nobody speaks.
[Limits] Only the people and objects of the first frame are ever in the picture. Faces and bodies stay the same. One continuous shot. No text, captions or watermarks.
```

Times are approximate — models drift by a few tenths of a second. Leave slack and fix the beat in the edit.

## Errors that keep coming back, and what to write

| What goes wrong | Write it like this |
|---|---|
| A group does the same thing in the same instant | Give an order: "the coach turns first … a second later the goalkeeper … the striker last". Stage different poses in the first frame too |
| A person does by hand what the wind should do (she lifts the tablecloth herself) | State the cause and pin the hands: "a breeze lifts the corner of the tablecloth; both her hands stay around the cup the whole time" |
| Clouds, the moon or plants grow faces | Describe material, not character: "soft grey cumulus with only cotton-like texture and shading", and only describe how it moves |
| Someone walks the wrong way | Use screen directions: "walks towards frame left, past the shop door on the left" |
| A phrase is read the other way ("the dog behind the bench" ends up on the bench) | Pin the place: "on the grass behind the bench, bottom right; the bench stays empty" |
| The number of objects changes | Say the count: "exactly one red balloon; after it floats away her hand is empty" |
| "Don't …" is ignored ("the spout does not pour") | Say what is there instead: "the picture only ever contains the people of the first frame" |
| A prop gets used the way it usually is (a watering can starts pouring) | Keep that prop out of shots with action |
| Something appears from nowhere | Use only what is in the first frame |
| Something jumps or teleports | Describe the path: "the scarf slips off her left shoulder, she catches it at the elbow and wraps it back" |
| Rain, a hat or a tattoo disappears mid-shot | Draw it on both frames |
| Lightning looks too literal | Describe light, not a bolt: "the clouds light up white for a moment"; trim in the edit |
| Too much happens and the shot falls apart | One or two main actions per shot |
| The action finishes earlier or later than written | Leave slack, retime in the edit |
| The push-in is weaker than written | Strengthen it in post with a slow crop |
| Lips move although nobody talks | "Nobody speaks"; if it persists, fix it in post or cover with a cut |
| Music sneaks in although you wrote "no music" (reported on Seedance 2.5) | Do not use the clip's audio; lay sound in the edit |
| The last few frames jump to the last keyframe (reported on Seedance 2.5) | Freeze on the last good frame in the edit |
| The very first frame is over-sharp (reported on Seedance 2.5) | Trim it |
| The picture gets darker and cooler towards the end (reported on Seedance 2.0 mini) | Match each clip's colour back to its own first frame in the edit |

Rows marked *reported* come from other people's renders and are not guaranteed; check your own clips with `director_frames`.

## Before you ask for review

- Every block present; the timing covers 0 to the end.
- Screen directions, counts and hand positions written out.
- Nothing appears that is not in the first frame.
- The prompt and the two frames agree: positions, sides, colours, number of people and props, clothes, expressions.
