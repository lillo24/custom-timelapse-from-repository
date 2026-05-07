# 15 - Repo playback calibration and QA pass

## Goal

Make the repository timelapse feel usable for presentation recording.

Do **not** add sync with the document scene yet.  
Do **not** add export/Remotion.  
Do **not** change preprocessing unless a tiny type fix is required.

## Current context

`14` added Play/Pause, speed buttons, requestAnimationFrame autoplay, enter/exit transitions, layout resizing, and recent-change glow in `src/scenes/RepoExplorerScene.tsx`.

Now tune the repo scene so playback has a predictable duration and does not become too slow/fast because the model has thousands of timeline units.

## Required changes

### 1. Add presentation duration presets

Add a compact duration control near the repo timeline controls:

- `15s`
- `30s`
- `45s`
- `60s`

Default: `30s`.

Autoplay should map the whole timeline to the selected duration:

```ts
unitsPerSecond = totalUnits / selectedDurationSeconds * speedMultiplier
```

The existing speed buttons should remain as multipliers:

- `0.5x`
- `1x`
- `2x`
- `4x`

So `30s + 2x` should finish in about `15s`.

### 2. Keep manual controls intact

Keep:

- slider
- previous
- next
- reset
- play/pause
- speed buttons

Manual interaction should pause autoplay only if that is already the current behavior. Do not redesign the control bar.

### 3. Performance sanity

Avoid expensive full recomputation every animation frame if it is currently obvious in the code.

A small memoized/cached helper is okay, but do not over-engineer.

The scene only needs to handle a few hundred files and around 10k units smoothly.

### 4. Preserve the visual-size invariant

Very important:

- file geometry must come from replayed `currentLineCount`, bounded by each file’s visual envelope;
- do **not** compute file size from `addedLines + deletedLines`;
- activity mass may only affect glow/intensity/timing.

Example: `+100 / -90` must not look like a permanently 190-line bigger file.

### 5. No layout regressions

Check that:

- the repo scene still fits in the viewport;
- no accidental page scrollbar appears;
- controls do not overflow the bottom;
- the document scene is untouched.

## Validation

Run:

```bash
npm run build
```

If practical, also run the app and briefly inspect the repo scene. Report any visual QA limitation honestly.
