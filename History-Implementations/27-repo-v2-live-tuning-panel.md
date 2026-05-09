# Prompt 27: Add live React tuning panel for Repo Explorer V2

## Goal

Add a UI-only live tuning panel for Repo Explorer V2 so I can tweak visual size/growth values directly in the browser without rerunning the preprocessing pipeline every time.

This is for fast visual tuning only.

The final reproducible source of truth should still be:

```txt
repo-animation.config.json
```

The tuning panel should help me find good values, then copy them back into the config.

## Important distinction

### React tuning panel should control visual-only values

Good live-tunable values:

```txt
baseRowHeightRem
maxExtraHeightRem
baseFontSizeRem
maxExtraFontSizeRem
per tracked node maxVisualPercent
glow/heat intensity, if easy
```

These do not require rebuilding the display model.

### Preprocessing is still required for structural values

Do not try to live-edit structural rules like:

```txt
maxVisibleRows
maxChildrenByFolder
hideButCount
sizeTrackedNodes membership
collapse/default visibility logic
timeline mapping
```

Those still require:

```bash
npm run build:animation-data -- --repo ../thesis-disi-chatbot --config repo-animation.config.json
```

## Where to add it

Add this only to the live Repository scene.

Do not show it in the frozen V1 snapshot scene.

The V1 snapshot should stay clean and unchanged.

## UI behavior

Add a small floating button in the live repo scene, for example:

```txt
Tune
```

Clicking it opens a compact floating tuning panel.

The panel should be easy to hide and should not permanently take layout space.

It should not affect the file explorer layout by pushing content around.

## Controls to add

### Global sizeTrackingStyle controls

Expose sliders/inputs for:

```txt
baseRowHeightRem
maxExtraHeightRem
baseFontSizeRem
maxExtraFontSizeRem
```

Suggested ranges:

```txt
baseRowHeightRem: 0.8 → 2.0
maxExtraHeightRem: 0 → 4.0
baseFontSizeRem: 0.55 → 1.2
maxExtraFontSizeRem: 0 → 0.8
```

Use reasonable step sizes:

```txt
0.05 rem
```

### Per tracked node controls

For each node that has size-tracking metadata, show:

```txt
label/path
maxVisualPercent slider
```

Suggested range:

```txt
0 → 200
```

Step:

```txt
5
```

Example:

```txt
ingestion_pipeline/retrieval    100%
ingestion_pipeline/extract       80%
assistant_runtime               120%
```

These overrides should affect rendering immediately.

## localStorage

Persist tuning overrides in localStorage so refreshing the browser does not lose the test values.

Use a scoped key like:

```txt
repoExplorerV2Tuning
```

or similar.

Add a reset button:

```txt
Reset tuning
```

This should clear localStorage and return to the values from the loaded display model.

## Copy config JSON

Add a button:

```txt
Copy config JSON
```

It should copy a JSON snippet that I can paste back into `repo-animation.config.json`.

The copied snippet should include only the relevant part, for example:

```json
{
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
    }
  }
}
```

If the actual config nests this inside `display`, make that clear in the copied text or include the `display` wrapper if easier.

## Rendering logic

The tuning overrides should override the loaded display model values at render time only.

Do not mutate the loaded model object in place if avoidable.

Prefer a derived object/state:

```txt
effectiveSizeTrackingStyle
effectiveMaxVisualPercentByNode
```

Then rendering uses the effective values.

## V1 safety

The frozen V1 scene should not show the tuning panel.

If the shared component is reused, expose a prop like:

```tsx
enableTuningPanel={false}
```

for V1 and:

```tsx
enableTuningPanel={true}
```

for the live Repository scene.

## Critical invariant

Never use total activity mass as visual geometry.

Wrong:

```txt
visual size = addedLines + deletedLines
```

Correct:

```txt
visual size = replayed currentLineCount / persistent line counts
```

The live tuning panel may change how that ratio is rendered, but it must not change the source of the ratio.

Activity mass can drive:

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

## Styling

Keep the panel compact.

Avoid:

```txt
large dashboard
heavy border
huge background card
permanent layout space
```

Allowed:

```txt
small floating glass/dark panel
small sliders
small labels
small copy/reset buttons
```

It should be practical, not beautiful.

## Constraints

- UI-only change if possible.
- Do not change preprocessing.
- Do not regenerate display model.
- Do not change `repo-animation.config.json` automatically.
- Do not change V1 snapshot data.
- Do not touch the document/Word scene.
- Do not reintroduce `+ N more`.
- Do not reintroduce `collapseFolders`.
- Do not solve layout by scrollbars.
- Keep TypeScript/build clean.

## Validation

Run:

```bash
npm run build
```

Browser check:

```txt
Live Repository scene has a Tune button/panel.
V1 Repository snapshot has no tuning panel.
Changing sliders immediately changes visual sizing.
Refresh keeps overrides through localStorage.
Reset tuning restores loaded model values.
Copy config JSON gives a usable snippet.
No geometry uses addedLines + deletedLines.
```

## Success criteria

- I can tune Repo Explorer V2 size styling directly in React.
- I do not need to rerun preprocessing for purely visual size tweaks.
- I can copy the tuned values back into config.
- V1 remains frozen/clean.
- `npm run build` passes.
