# Prompt: Fix LineCounterOverlay scope regression

## Goal

Correct the last LineCounterOverlay changes that went too far.

The counter already exists and already uses real repo timeline data. Do **not** redesign it again.

## Problem to fix

The previous change moved the counter to true top-left and changed more behavior than needed.

What I actually wanted was much smaller:

- make the sliding `+N` / `-N` badge numbers a bit bigger
- keep the counter visually where it was before, around the top-center / previous overlay position
- do not add a new UI settings panel
- do not keep changing the component architecture

## Files likely involved

Inspect and edit only if needed:

```txt
src/components/repo/LineCounterOverlay.tsx
src/scenes/RepoExplorerScene.tsx
```

## Required changes

### 1. Restore the previous position

Move the counter back from true top-left to its previous top-center / stage-top position.

Do not let it cover the file explorer sidebar.

If the exact old class is recoverable from Git history, use that. Otherwise use a simple centered fixed/absolute placement similar to:

```tsx
className="pointer-events-none fixed left-1/2 top-4 z-50 -translate-x-1/2"
```

Adapt to the current layout if the overlay is inside the scene rather than viewport-fixed.

### 2. Only enlarge the sliding badge number

Increase the font size of the animated `+N` / `-N` badge that slides/merges into the total container.

Do not make the whole counter huge.

Target: the incoming delta number should be noticeably more readable, about 20–35% bigger than now.

### 3. Do not add UI configurability

There should be no new UI for counter speed/timing.

If settings constants exist inside `LineCounterOverlay.tsx`, they can stay as internal code constants.

But do not expose them as UI controls.

### 4. Preserve real data behavior

Keep the counter connected to real repo timeline data.

Counter delta must still use:

```txt
netDelta = afterLineCount - beforeLineCount
```

Do not use:

```txt
addedLines + deletedLines
```

### 5. Avoid unnecessary behavior changes

Do not change batching/timing again unless required to preserve existing behavior.

Do not refactor the whole component.

Do not touch preprocessing, display model, file explorer layout, playback controls, or document scene.

## Critical invariant

For line counter value and file geometry:

```txt
+100 / -90 should count roughly as +10, not +190.
```

Activity mass can still be used for glow/intensity elsewhere, but not for line-count totals or geometry.

## Validation

Run:

```bash
npm run build
```

Manual check:

- counter is back near the previous top-center position
- sliding `+N` / `-N` number is bigger and readable
- no new settings panel exists
- repo playback still drives the counter
- document scene is unchanged
