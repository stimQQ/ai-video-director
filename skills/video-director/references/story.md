# Writing the story

**A story is ready for the storyboard when you can say what it is about in one sentence, every turn survives a "would this really happen?" check, and every shot is something today's video models can actually render.**

Work it out with the user in conversation first. Ask about anything unclear; do not invent the ending they had in mind. Save it with `director_save` section `story`: `logline` (the one sentence), `text` (the shot-by-shot story) and `beats` (the turns, in order).

## Six checks

1. **It holds together.** Walk every turn and ask: why does this happen, where did this object come from, can the character actually reach it, would a real person do this? Fantasy is fine; inconsistency is not. If the film is deliberately absurd, say so in the logline.
2. **It says one thing.** Write the logline before anything else. If you cannot, the story is still a list of events — find the point before going on.
3. **The first seconds earn the rest.** People decide within two or three seconds whether to keep watching. Put the most striking image first and name the second it appears.
4. **Bystanders react like people.** Write each turn as three parts: the problem, how the lead deals with it, how the others react. Reactions arrive one after another, never in the same instant — three people raising a hand together is the giveaway of a generated video. Bodies react too: someone startled leans back before they speak.
5. **It can be filmed.** Today's video models still fumble a known list of things (below). Design around them now; it is free at this stage and expensive later.
6. **Shots stand on their own.** Prefer a structure of separate moments — each shot works without the previous one matching perfectly. Continuous action across cuts (a glass half full in shot 3 must be half full in shot 4) is where AI films break; use it only when the user asks for it.

## What to keep out of the story

| Hard for the models | Do this instead |
|---|---|
| Two characters crossing paths or swapping sides | Keep each person on their own side of the frame |
| Hands holding small objects (keys, phones, pens) | Larger props, or the object resting on a surface |
| Readable text (signs, screens, letters) | No text in frame; add titles in the edit |
| Mirrors, glass reflections, water reflections | Shoot past the reflective surface |
| Features that differ left vs right (a scar, a parting, one earring) | Avoid, or put it on every keyframe and the sheet |
| A lighting change inside one shot | Change light between shots |
| One person doing three things in one shot | One or two actions per shot |
| A top-down view that hides the face during the key moment | Angle that keeps the face visible |
| Crowds of supporting characters | Two or three people per shot at most |

## If there is music

Turns land on the chorus, key actions on strong beats. Note the bar or the second next to each beat so the storyboard can time shots to it.

## Before moving on

Have a fresh reviewer read only the saved story with the story brief in [review-briefs.md](review-briefs.md). Fix what it finds, then ask the user to approve the Story tab.
