# Prompt 26: Make size-tracking visual size configurable in rem/percent

## Goal

Fix the Repo Explorer V2 size-tracking config so I can control **how big tracked nodes can visually get**.

Right now the system uses something like:

```json
"sizeTrackedNodes": {
  "ingestion_pipeline/retrieval": {
    "maxScale": 1.7
  }
}
```

This is not intuitive enough.

I want two separate concepts:

1. **What visual size means 100% growth**  
2. **How much of that 100% each tracked node is allowed to use**

## Desired config shape

Update `repo-animation.config.json` to support something like:

```json
{
  "display": {
    "sizeTrackingStyle": {
      "baseRowHeightRem": 1.1,
      "maxExtraHeightRem": 2.0,
      "baseFontSizeRem": 0.72,
      "maxExtraFontSizeRem": 0.25
    },
    "sizeTrackedNodes": {
      "ingestion_pipeline/retrieval": {
        "maxVisualPercent": 100
      },
      "ingestion_pipeline/extract": {
        "maxVisualPercent": 80
      },
      "assistant_runtime": {
        "maxVisualPercent": 120
      }
    }
  }
}
```

Meaning:

```txt
baseRowHeightRem = default row height
maxExtraHeightRem = extra height available at 100%
baseFontSizeRem = default font size
maxExtraFontSizeRem = extra font size available at 100%
maxVisualPercent = how much of that configured 100% this node can use
```

Example:

```txt
baseRowHeightRem = 1.1
maxExtraHeightRem = 2.0
```

Then:

```txt
maxVisualPercent 100 => max row height = 1.1 + 2.0 = 3.1rem
maxVisualPercent 80  => max row height = 1.1 + 1.6 = 2.7rem
maxVisualPercent 120 => max row height = 1.1 + 2.4 = 3.5rem
```

## Replace old maxScale

Replace or migrate the old per-node field:

```json
"maxScale": 1.7
```

with:

```json
"maxVisualPercent": 100
```

Do not keep both unless you need temporary compatibility for safety.

If old `maxScale` exists, either:

- remove it from the config and types, or
- support it with a warning and convert it internally.

Preferred: clean config with `maxVisualPercent`.

## Responsibilities

### Config

Config should define:

```txt
which nodes are size-tracked
how much visual growth each node can use
the rem-based visual size range for 100%
```

### Display model preprocessing

The display model should resolve size-tracking metadata per node.

Suggested metadata:

```ts
sizeTracking?: {
  enabled: boolean;
  maxVisualPercent: number;
  normalizationMaxLines: number;
}
```

Also include the global style somewhere in the display model, for example:

```ts
sizeTrackingStyle?: {
  baseRowHeightRem: number;
  maxExtraHeightRem: number;
  baseFontSizeRem: number;
  maxExtraFontSizeRem: number;
}
```

Names can differ if cleaner.

### React

React should apply the CSS sizing.

For a tracked node:

```txt
lineRatio = currentLineCount / normalizationMaxLines
lineRatio = clamp(lineRatio, 0, 1)

visualPercentRatio = maxVisualPercent / 100

rowHeightRem =
  baseRowHeightRem + lineRatio * visualPercentRatio * maxExtraHeightRem

fontSizeRem =
  baseFontSizeRem + lineRatio * visualPercentRatio * maxExtraFontSizeRem
```

Untracked nodes should keep the normal compact file-explorer row style.

## Normalization

Keep the existing line-count normalization idea:

```txt
normalizationMaxLines = max(maxLineCount of all configured size-tracked nodes)
```

So the biggest configured tracked node is the reference for line growth.

This prompt is **not** asking for manual line-count normalization yet.

It is asking for manual **visual size tuning**.

## UI behavior

The visual result should stay subtle and file-explorer-like.

Allowed:

```txt
tracked node row gets taller
tracked node font gets slightly larger
tracked node connector/line can remain aligned
```

Avoid:

```txt
giant cards
folder containers
horizontal width explosion
scrollbar-based solution
```

The scene should still look like a file explorer.

## V1 safety

Do not modify V1 snapshot data.

The V1 scene should remain safe:

```txt
/data/snapshots/repo-display-model-v1.json
```

If the shared React scene receives a V1 model without `sizeTrackingStyle`, it should fall back to compact default behavior.

## Critical invariant

Do not compute geometry from activity mass.

Wrong:

```txt
visual size = addedLines + deletedLines
```

Correct:

```txt
visual size = replayed currentLineCount / persistent line counts
```

Activity mass can still drive:

```txt
glow
heat
pulse
timing intensity
```

but not height/font-size/geometry.

Example:

```txt
+100 / -90
```

must not make the file look 190 lines bigger. Its net file-state change is about +10.

## Constraints

- Work mainly in:
  - `repo-animation.config.json`
  - config types/loaders
  - `scripts/generate-display-model.ts`
  - display model types
  - `src/scenes/RepoExplorerScene.tsx`
- Do not change raw Git extraction.
- Do not change file-state reconstruction.
- Do not change change-unit generation.
- Do not reintroduce `+ N more`.
- Do not reintroduce `collapseFolders`.
- Do not break dynamic `maxVisibleRows`.
- Do not touch the document/Word scene.
- Keep build clean.

## Validation

Run:

```bash
npm run build:animation-data -- --repo ../thesis-disi-chatbot --config repo-animation.config.json
npm run build
```

Browser check:

```txt
V1 snapshot still behaves like V1.
Live Repository scene applies sizeTrackingStyle.
A node with maxVisualPercent 80 grows less than 100.
A node with maxVisualPercent 120 can grow more than 100.
Untracked nodes keep compact row style.
No geometry uses addedLines + deletedLines activity mass.
```

## Success criteria

- Config has `sizeTrackingStyle`.
- Size-tracked nodes use `maxVisualPercent`, not `maxScale`.
- React uses rem-based style limits from the display model/config.
- Biggest configured tracked node still defines line-count 100%.
- Visual 100% size is now tunable with rem values.
- `npm run build` passes.
