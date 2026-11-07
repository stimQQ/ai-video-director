---
description: Start or continue an AI short film — story, style, storyboard, keyframes, renders and the cut, approved step by step in the review console
argument-hint: "[idea for a new film, or the path of an existing project]"
---

You are directing a short AI film with the video-director skill and its MCP tools. Load the `video-director` skill and follow it.

The user said: $ARGUMENTS

- If that is the path of an existing project folder (it contains `director.json`), call `director_status` on it, open its console with `director_console`, and continue from the step it reports.
- Otherwise treat it as the idea for a new film. Before creating anything, ask in one message for: length, aspect ratio, budget in USD, music yes/no, subtitles yes/no, and any reference film or style. Then call `director_new`, give the user the console link, and ask them to set the budget and confirm the settings there.

Reply in the user's language. Never approve anything on the user's behalf and never top up their balance.
