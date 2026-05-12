# Prompt 33: Add rough history trim by visual progress percent

## Goal

Add a configurable way to cut the end of the repository animation by **rough visual progress**, for example:

```txt
trim the last 30% of the generated timeline
```

This is useful when the last part of repo history is not relevant for the presentation.

This should be a preprocessing feature, not a React-only slider trick.

---

## Desired config

Extend `repo-animation.config.json` with a history section.

Example:

```json
{
  "history": {
    "trimEndProgressPercent": 30
  }
}
```

Meaning:

```txt
Keep roughly the first 70% of the generated visual progression.
Drop the last 30%.
```

Defaults:

```txt
trimEndProgressPercent = 0
```

If missing or 0, keep current behavior.

Clamp safely:

```txt
0 <= trimEndProgressPercent < 100
```

If invalid, fail with a clear error or warning.

---

## Important concept

Do **not** trim by calendar dates.

Do **not** trim by commit count.

The animation is already line/activity-unit based, so trim by the generated visual timeline units.

Preferred interpretation:

```txt
repo-change-units
→ remove last X% of units
→ downstream visual/display model uses the trimmed units
```

Example:

```txt
total units = 10,000
trimEndProgressPercent = 30
keep units 0..6,999
drop units 7,000..9,999
```

This matches the visual progression better than commit count.

---

## Where to implement

Best place: after change-unit generation and before final animation dataset / visual model / display model.

Possible options:

### Option A: in filtering/dataset step

When building `repo-animation-dataset.json`, only include units up to the trim cutoff.

### Option B: separate trim step

Add a small preprocessing helper step:

```txt
repo-change-units.json
→ repo-change-units-trimmed.json
```

Then downstream uses trimmed units.

Choose the cleaner option for the current pipeline.

Do not trim raw Git history unless needed. The raw history can remain full for audit/debug.

---

## Critical consistency requirement

If units after the cutoff are removed, final file state for the animation must match the trimmed timeline, not the full final repo.

So after trimming:

```txt
visible final state = state at the trim cutoff
line counters = totals up to the trim cutoff
folder/file current sizes = sizes at the trim cutoff
fire/glow/timeline = based only on retained units
```

Avoid this bug:

```txt
timeline is trimmed
but final file line counts still come from full repo
```

If current visual/display model uses full finalLineCount/maxLineCount from full file states, adjust it so the generated animation model is consistent with the trimmed timeline.

Acceptable approach:

```txt
keep maxLineCount as maximum within retained timeline
finalLineCount as line count at retained final unit
```

This may require reconstructing or deriving trimmed final state from timeline units.

---

## Metadata / audit

Write the resolved trim info into generated outputs.

Examples:

```json
{
  "historyTrim": {
    "trimEndProgressPercent": 30,
    "sourceUnitCount": 10000,
    "keptUnitCount": 7000,
    "droppedUnitCount": 3000,
    "cutoffUnitOrder": 6999
  }
}
```

Include this metadata in at least:

```txt
repo-animation-dataset.json
repo-visual-model.json
repo-display-model.json
repo-animation-summary.json
```

or wherever it is cleanest and visible.

Console output should include:

```txt
History trim: kept 7,000 / 10,000 units, dropped 30.0%
```

---

## Pipeline runner

Update:

```bash
npm run build:animation-data -- --repo ../thesis-disi-chatbot --config repo-animation.config.json
```

so it automatically applies the trim config.

Do not require a new manual command for normal use.

Optional CLI override is okay if easy:

```bash
--trim-end-progress-percent 30
```

but config is enough.

---

## React behavior

React should not need special trim logic.

It should consume the generated model as usual.

Because the display model is already trimmed, the UI should naturally show the shortened story.

Make sure:

```txt
slider max
line counters
final rest frame
fire/glow
playback duration
```

all work with the trimmed timeline.

---

## V1 snapshot safety

Do not modify the frozen V1 snapshot files.

The live generated data can be trimmed.  
The V1 snapshot must remain unchanged.

Do not overwrite:

```txt
public/data/snapshots/repo-display-model-v1.json
```

---

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

Activity mass can drive:

```txt
glow
fire
pulse
timing intensity
```

but not row/file geometry.

If the timeline is trimmed, geometry should still come from the retained timeline's current line states.

---

## Constraints

- Do not change React unless needed for metadata display or compatibility.
- Do not trim by date.
- Do not trim by commit count.
- Do not change the document/Word scene.
- Do not reintroduce `+ N more`.
- Do not reintroduce `collapseFolders`.
- Do not break V1 snapshot.
- Keep output deterministic.
- Keep TypeScript/build clean.

---

## Validation

Run:

```bash
npm run build:animation-data -- --repo ../thesis-disi-chatbot --config repo-animation.config.json
npm run build
```

Test with:

```json
"history": {
  "trimEndProgressPercent": 30
}
```

Verify:

```txt
generated timeline has about 70% of previous units
summary reports trim metadata
slider ends earlier
line counters end at trimmed totals
final repo state matches trimmed endpoint
V1 snapshot remains unchanged
```

Also test with:

```json
"history": {
  "trimEndProgressPercent": 0
}
```

or by removing the field, and verify current behavior remains unchanged.

## Success criteria

- Config can roughly cut the last X% of visual history.
- Trimming is based on visual timeline units, not dates or commit count.
- Generated model state is internally consistent with the trimmed timeline.
- React scene works without special trim logic.
- V1 snapshot is not modified.
- `npm run build` passes.
