# Prompt 13: Size repo file cards from current line state

## Goal

Improve the existing repo progression UI so file card size changes with the file's **current line count at the selected timeline unit**, not only with the final/static visual size.

This is still repo UI only. Do not touch the document/Word scene.

## Critical invariant

Do **not** compute visual file size from total activity mass.

Wrong:

```ts
visualSize = addedLines + deletedLines
```

Because this would make `+100 / -90` look like a 190-line bigger file, even though the real final size changed only by `+10`.

Correct:

```ts
visualSize = currentLineCount
```

Where `currentLineCount` comes from replaying actual file state over time:

```txt
beforeLineCount -> afterLineCount -> finalLineCount / maxLineCount
```

Activity mass may still control glow/intensity/recent-change emphasis, but never card geometry.

## What to implement

In `RepoExplorerScene.tsx`, derive a current visible file state from the selected timeline unit.

For each visible file, compute:

```ts
type CurrentRepoFileState = {
  path: string;
  exists: boolean;
  currentLineCount: number;
  maxLineCount: number;
  finalLineCount: number;
  recentlyChanged: boolean;
};
```

Use the visual model timeline units to update `currentLineCount` while replaying units up to the selected index.

Use available fields such as:

- `beforeLineCount`
- `afterLineCount`
- `lineDelta`
- `finalLineCount`
- `maxLineCount`

Inspect the existing generated model/types and adapt to the real field names.

## Sizing rule

File card geometry should be based on `currentLineCount`, clamped into readable presentation sizes.

Example logic:

```ts
const ratio = currentLineCount / Math.max(1, maxLineCount);
const visualScale = 0.45 + Math.sqrt(ratio) * 0.75;
```

The exact formula can differ, but it must satisfy:

- zero/small files stay visible;
- large files do not dominate the whole screen;
- growth/shrink follows real current line state;
- activity weight does not affect width/height.

## Rename/delete behavior

Preserve current behavior:

- created files appear;
- deleted files disappear;
- renamed files keep continuity when the model provides enough metadata;
- if rename metadata is incomplete, prefer a safe fallback and keep a warning/comment in code.

## Keep existing behavior

Keep:

- scene switcher;
- repo explorer layout;
- previous / next / reset / slider controls;
- recent activity glow.

But recent glow must remain visual emphasis only, not geometry.

## Do not add yet

- No autoplay.
- No playback speed control.
- No sync with the document scene.
- No Remotion/export.
- No new preprocessing scripts unless absolutely necessary.
- No redesign of the whole repo scene.

## Validation

Run:

```bash
npm run build
```

Optionally run the data pipeline again if needed:

```bash
npm run build:animation-data -- --repo ../thesis-disi-chatbot --config repo-animation.config.json
```

## Success criteria

- Moving the slider changes which files exist.
- Moving the slider also changes file card size according to current line count.
- A file with `+100 / -90` does not become visually huge just because 190 lines were touched.
- Recent change glow still works.
- `npm run build` passes.
