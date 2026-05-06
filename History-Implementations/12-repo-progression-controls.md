# 12 - Add first repository progression controls

## Goal

Add the first real progression layer to the repository scene.

The repo scene is currently static. Now make it possible to move through `repo-visual-model.timeline` with simple controls and show the repository as it existed at the selected timeline unit.

## Scope

Work mainly in:

- `src/scenes/RepoExplorerScene.tsx`
- add small helper files only if it keeps the scene cleaner
- reuse `src/preprocessing/visualModelTypes.ts`

No preprocessing changes unless strictly necessary.

## Required behavior

Add local state for the active timeline position:

```ts
activeUnitIndex: number
```

Controls:

- previous
- next
- reset
- range slider
- small label like `Unit 1200 / 9279`

For now, no autoplay.

## Visibility rule

At a given active unit, a file is visible if it has already appeared:

```ts
file.firstUnitOrder !== null && file.firstUnitOrder <= activeUnit.unitOrder
```

Hide files that have not appeared yet.

If delete units are easy to support safely, deleted files can disappear after their delete unit. If not, leave deletion for later and add a TODO comment.

## Size rule — very important

Do **not** size cards from total activity.

Wrong:

```ts
visualSize = addedLines + deletedLines
```

Correct:

- permanent card size comes from the visual model file fields:
  - `visualSize`
  - `visualWeight`
  - `maxLineCount`
  - `finalLineCount`
- timeline activity can affect only temporary visual cues:
  - glow
  - pulse
  - opacity
  - highlight

Example invariant:

```txt
+100 / -90 should not look like a 190-line larger file.
The persistent file size changed only by +10 lines.
```

## Active change cue

Highlight files touched near the current unit.

Simple rule is enough:

```ts
recentUnitWindow = last 20 units before current unit
```

Files touched in that window get a subtle glow/pulse.

This glow may use `activityWeight`.

But card size must still use persistent file-size fields only.

## Layout constraints

- Keep the existing static repository scene design.
- Do not redesign the scene.
- Do not add the document/Word scene sync yet.
- Do not add Remotion.
- Do not add autoplay/speed controls yet.
- Keep `npm run build` passing.

## Success criteria

- Slider/next/previous changes the visible file set.
- Files pop into visibility as the timeline advances.
- Recently touched files glow subtly.
- Card size does not depend on `addedLines + deletedLines` or `activityWeight`.
- `npm run build` passes.
