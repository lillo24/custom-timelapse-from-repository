# 14 - Repo autoplay + motion polish

## Goal

Add the first real timelapse feeling to the repository scene.

The repo scene already has manual progression and current line-count sizing. Now add:

- play / pause
- playback speed
- smooth card appearance/disappearance
- smooth grow/shrink transitions
- recent-change pulse/glow

Keep this focused only on the repo scene.

## Important invariant

Do **not** size files from activity mass.

Wrong:

```ts
visualSize = addedLines + deletedLines;
```

Correct:

```ts
visualSize = currentLineCount; // replayed from beforeLineCount -> afterLineCount
```

Activity mass may affect only:

- glow intensity
- pulse strength
- timing emphasis
- recent-change styling

It must never make a file geometrically bigger.

Example: `+100 / -90` should not look like a 190-line bigger file. Its final visible size change is only `+10`.

## What to implement

In `RepoExplorerScene.tsx`:

1. Add `Play/Pause` control.
2. Add a simple speed control, for example:
   - `0.5x`
   - `1x`
   - `2x`
   - `4x`
3. When playing, advance through timeline units automatically.
4. Stop or loop safely at the end. Prefer stop at end for now.
5. Animate visible file cards:
   - new file: fade + small scale pop
   - deleted file: fade out if easy, otherwise disappear cleanly
   - modified file: subtle glow/pulse
   - line-count change: smooth width/height transition
6. Keep manual slider / previous / next / reset working.

## Implementation notes

Use existing React/Motion setup if already available.

Prefer simple state + `requestAnimationFrame` or a small interval. Do not overbuild a timeline engine.

Because the model can have many units, playback should support stepping by more than 1 unit per tick depending on speed. Avoid doing expensive full recomputation if there is an obvious small optimization, but do not rewrite the whole scene.

## Constraints

- Do not touch the document/Word scene.
- Do not add Remotion.
- Do not add export/video logic.
- Do not add synchronization between document and repo scenes.
- Do not change preprocessing scripts.
- Do not change `repo-visual-model.json` format unless absolutely necessary.
- Do not redesign the whole explorer layout.
- Keep the page inside the viewport without accidental scrollbars.

## Success criteria

- The repo scene can play automatically.
- Manual controls still work.
- Files appear/grow/shrink smoothly.
- Recent activity is visible but not overwhelming.
- File geometry is still based on replayed current line count, not `addedLines + deletedLines`.
- `npm run build` passes.
