# Prompt 30: Calibrate fire thresholds so heat has 0/1/2/3 levels

## Goal

Fix the Repo Explorer V2 fire indicator thresholds.

Right now the fire effect is basically binary:

```txt
0 fire
or
3 fires
```

Even at slow playback like:

```txt
30s duration + 0.5x speed
```

it jumps too quickly to max fire.

The fire system should show a smoother range:

```txt
0 fire
1 fire
2 fires
3 fires
```

## Diagnosis

The current thresholds are probably based on raw recent hit count, for example:

```txt
heatScore = number of recent units mapped to this node
```

But timeline units can be dense, so one burst immediately exceeds the max threshold.

Instead, make fire tier depend on a normalized/damped recent activity score.

## Desired behavior

Fire should represent **recent repeated activity density**, not total lifetime activity.

At normal presentation speed:

```txt
30s duration + 1x speed
```

the effect should usually show:

```txt
mostly 0/1 fire
sometimes 2 fires during active bursts
3 fires only during very intense repeated edits
```

At slower playback:

```txt
30s + 0.5x
```

it should not immediately jump to 3 fires.

## Better heat formula

Replace raw count thresholds with a normalized score.

Suggested model:

```ts
heatScore =
  recentHitsForNode / fireWindowSize
```

or weighted:

```ts
heatScore =
  weightedRecentHitsForNode / maxPossibleRecentWeight
```

Then use tier thresholds like:

```txt
0 fire: heatScore < 0.08
1 fire: 0.08 <= heatScore < 0.20
2 fires: 0.20 <= heatScore < 0.38
3 fires: heatScore >= 0.38
```

The exact numbers can be adjusted, but the key is:

```txt
normalize by window size
```

so a larger/smaller window does not destroy the tiers.

## Add tuning controls if not already present

In the live V2 tuning panel, add or improve fire controls:

```txt
Fire window size
Tier 1 threshold
Tier 2 threshold
Tier 3 threshold
Fire size
```

Use normalized thresholds, not raw integer hit counts.

Suggested defaults:

```txt
fireWindowSize = 36
tier1 = 0.08
tier2 = 0.20
tier3 = 0.38
fireSizePx = 18
```

Persist these values in the existing localStorage tuning system.

Add `Reset fire tuning` or include fire values in the existing reset.

Do not show fire tuning in V1.

## UI feedback / debug

Add a small optional debug readout inside the tuning panel only, not in the explorer rows:

```txt
selected/hottest node
heatScore
fireTier
recentHits
```

This helps tune thresholds without guessing.

Keep it compact.

## Fire tier mapping

The renderer should use:

```txt
tier 0 => no fire
tier 1 => one fire
tier 2 => two fires
tier 3 => three fires
```

Do not skip directly from 0 to 3 unless the normalized score is actually above the tier 3 threshold.

## End/rest frame

At the final calm/rest frame:

```txt
heatScore = 0
fireTier = 0
```

No fire should remain.

## Important distinction

Keep this separation:

```txt
size tracking = row/font growth from current line count
fire = recent repeated activity density
```

Do not reintroduce persistent growth glow.

## Critical invariant

Never use total activity mass as geometry.

Wrong:

```txt
visual size = addedLines + deletedLines
```

Correct:

```txt
visual size = replayed currentLineCount / persistent line counts
```

Activity/frequency can drive fire tier, glow, pulse, timing intensity, but not height/font-size/geometry.

## Constraints

- Work mainly in `src/scenes/RepoExplorerScene.tsx`.
- Do not change preprocessing unless absolutely necessary.
- Do not touch V1 snapshot behavior.
- Do not reintroduce `+ N more`.
- Do not reintroduce `collapseFolders`.
- Do not solve this with scrollbars.
- Do not touch the document/Word scene.
- Keep TypeScript/build clean.

## Validation

Run:

```bash
npm run build
```

Browser check:

```txt
At 30s + 0.5x, fire no longer jumps mostly from 0 to 3.
At 30s + 1x, fire tiers are visible as 0/1/2/3.
3 fires appear only for intense repeated activity.
Fire disappears at the final rest frame.
V1 has no fire tuning and stays stable.
No geometry uses addedLines + deletedLines.
```

## Success criteria

- Fire heat uses normalized/damped recent activity.
- Thresholds produce meaningful 1-fire and 2-fire states.
- Tuning panel can adjust thresholds live.
- Fire remains recent-activity based only.
- `npm run build` passes.
