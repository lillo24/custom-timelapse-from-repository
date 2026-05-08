# Prompt: Add Call-of-Duty-style line counter overlay

## Goal

Add a fixed floating **line counter overlay** to the repository scene.

It should look like a game/cash counter:

```txt
[ Lines 12,430 ]   +84
```

The `+84` / `-31` appears on the right, then slides left into the main counter container and merges into the total.

Place it fixed/floating in the **top-left** of the viewport so it does not affect the repo layout.

## Scope

Work only on the repository scene/UI.

Likely files:

- `src/scenes/RepoExplorerScene.tsx`
- optional new component: `src/components/repo/LineCounterOverlay.tsx`

Do not change preprocessing unless absolutely necessary.

## Counter meaning

The main counter should represent the replayed current total line state of the repository/display model.

Use real line-state deltas, not activity mass.

Correct delta:

```ts
lineDelta = afterLineCount - beforeLineCount
```

Wrong delta:

```ts
lineDelta = addedLines + deletedLines
```

Example:

```txt
+100 / -90 should create a +10-ish net counter change, not +190.
```

This is a counter of current line-state evolution, not total edit churn.

## Block behavior

Do not animate every tiny unit individually.

The counter should update in **blocks of edits**:

- when playback advances across several timeline units, aggregate their net line deltas
- show one floating `+N` or `-N` badge for that block
- animate the badge sliding into the main counter
- then merge it into the displayed total

Manual slider jumps can also produce one block delta from previous index to new index.

If the delta is `0`, do not show a badge.

## Visual behavior

Main container:

- fixed top-left
- compact
- dark/glass/cash-counter style
- high readability
- does not push layout
- z-index above repo scene but below any critical debug overlay if present

Delta badge:

- appears to the right of the counter
- `+N` for additions, `-N` for reductions
- slides left into the counter
- fades out or compresses on merge
- after merge, the total visibly updates

Use Motion if already available in the repo.

## Timing

Keep it snappy:

```txt
badge appear: ~100ms
hold: ~250ms
slide/merge: ~300ms
```

Exact values can be tuned in code constants.

Avoid long animations that lag behind playback.

If many blocks happen quickly, either:

- queue them briefly, or
- aggregate pending deltas into the next badge

Prefer simple aggregation over complex queue systems.

## Data/replay rules

Use the existing replay/timeline state from the repo scene.

The overlay should observe changes in the active timeline index and compute the net line delta between the previous active index and the new active index.

Forward playback:

```txt
sum deltas for units crossed forward
```

Backward slider/previous:

```txt
sum inverse deltas for units crossed backward
```

Reset:

- reset the total to the initial line count
- clear pending badge animations

Play from start should start from the initial line count.

## Important invariant

Do not use activity mass for the counter total.

Activity mass may still drive glow/heat elsewhere, but the line counter should follow actual replayed line state.

## Non-goals

Do not:

- change repo display-model generation
- change folder collapse logic
- change file/folder geometry
- change playback controls
- touch the document/Word scene
- add sound effects
- add global app state
- add a new route

## Success criteria

- A fixed top-left line counter appears in the repo scene.
- During playback, `+N` / `-N` badges appear and merge into the total.
- The counter updates by edit blocks, not every infinitesimal unit.
- The counter uses `afterLineCount - beforeLineCount`, not `addedLines + deletedLines`.
- Reset clears the counter state correctly.
- Manual slider/previous/next still work.
- The overlay does not affect layout.
- `npm run build` passes.
