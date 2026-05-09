# Prompt 29: Replace persistent size-growth glow with recent-activity fire indicators

## Goal

Fix the Repo Explorer V2 “hot/glow” behavior.

Right now size-tracked folders/files can look permanently glowing because the hot/teal effect is tied to growth/size.  
That is wrong.

New rule:

```txt
size tracking = row/font grows from current line count
fire/heat = recent repeated activity only
```

So:

```txt
large folder/file does not automatically glow
recently/frequently changed tracked node shows fire
no recent changes => fire disappears
```

Use the attached `fire.gif` as the visual asset.

---

## Files/assets

I will put `fire.gif` in the repo root for Codex.

Copy it into a Vite-safe public asset path, for example:

```txt
public/assets/fire.gif
```

Then React can use:

```txt
/assets/fire.gif
```

Do not inline/base64 it.

---

## Problem to fix first

In `src/scenes/RepoExplorerScene.tsx`, there is likely logic similar to:

```txt
trackedGrowthIntensity
→ rowGlowOpacity
→ boxShadow
→ textShadow
→ connector brightness
```

Remove this persistent growth glow.

Size-tracked nodes should still get:

```txt
row height growth
font size growth
maybe slight font weight growth if already present
```

But they should **not** get permanent glow/shadow just because they are big.

Keep recent edit/activity glow if it already exists, but do not confuse it with size growth.

---

## New fire behavior

Only show fire indicators for **size-tracked nodes** for now.

A node can show fire when it receives frequent recent timeline activity.

This should be based on a rolling/recent activity window, not total lifetime changes.

Example:

```txt
recentActivityWindow = last 20 or 30 timeline units
```

Compute something like:

```txt
heatScore = number of effective timeline units mapped to this display node inside the recent window
```

Use the effective mapped display node ids, so hidden child changes still heat the visible parent folder.

Do **not** use total activity over the whole replay.

---

## Fire tiers

Cap fire at 3 levels.

Example mapping:

```txt
heatScore 0      => no fire
heatScore 1-2    => 1 fire
heatScore 3-5    => 2 fires
heatScore >= 6   => 3 fires
```

Tune thresholds if the actual timeline is too dense/sparse, but keep it simple and deterministic.

The exact thresholds can be constants near the component logic.

---

## Fire visual placement

Render the fire GIF as an overlay decoration on the left of the row.

Rules:

- fire does not take layout space
- fire does not change row height/width
- fire is slightly detached from the file/folder name
- fire should not cover connector lines too aggressively
- only visible when heat tier > 0

Suggested visual:

### Tier 1

```txt
1 fire
rotated about -90deg or 90deg
left of the row/name
```

### Tier 2

```txt
2 fires
first as tier 1
second slightly lower and slightly shifted/rotated differently
```

### Tier 3

```txt
3 fires
third slightly upper and opposite tilt
```

Example implementation idea:

```tsx
<div className="pointer-events-none absolute left-[-18px] top-1/2 ...">
  <img src="/assets/fire.gif" ... />
</div>
```

Use the real row layout to choose safe offsets.

Keep it small. It should read as “hot activity,” not dominate the explorer.

---

## Fire animation/fade behavior

Fire should disappear naturally when recent activity disappears.

At the final rest/no-glow frame:

```txt
recentActivityWindow = empty
heatScore = 0
no fire
```

So the end state is calm.

If the current final rest frame already clears recent activity, wire fire to the same recent-activity logic.

If it does not, fix it so fire also clears in the rest frame.

---

## Tuning panel

If easy, add small fire tuning controls to the existing live Repo Explorer V2 tuning panel.

Useful controls:

```txt
Fire window size: 10-60 units
Tier 1 threshold
Tier 2 threshold
Tier 3 threshold
Fire size px
```

But do not overbuild.

If adding all controls is too much, at least make constants clean and easy to edit.

Do not show fire tuning in the V1 snapshot scene.

---

## Important distinction

Do not use fire for every file/folder.

For now:

```txt
fire only appears on size-tracked nodes
```

This keeps the visual clean.

Untracked nodes can still have normal recent edit glow if that already exists, but no fire.

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

Activity mass/frequency can drive:

```txt
fire tier
glow
heat
pulse
timing intensity
```

but not row height/font size/geometry.

Example:

```txt
+100 / -90
```

must not make the file look 190 lines bigger. Its net file-state change is about +10.

---

## V1 safety

Do not modify the frozen V1 snapshot data.

The V1 scene should stay clean:

```txt
/data/snapshots/repo-display-model-v1.json
```

Do not show the fire effect in V1 unless the shared component would do so accidentally. Prefer guarding it behind the live/V2 scene mode or metadata.

V1 should remain a stable snapshot.

---

## Constraints

- Work mainly in `src/scenes/RepoExplorerScene.tsx`.
- Add/copy the asset to `public/assets/fire.gif`.
- Do not change raw Git extraction.
- Do not change file-state reconstruction.
- Do not change change-unit generation.
- Do not change visual-model/display-model generation unless absolutely necessary.
- Do not reintroduce `+ N more`.
- Do not reintroduce `collapseFolders`.
- Do not solve this with scrollbars.
- Do not touch the document/Word scene.
- Keep TypeScript/build clean.

---

## Validation

Run:

```bash
npm run build
```

Browser check:

```txt
Size-tracked nodes can grow without permanent teal glow.
Fire appears only on size-tracked nodes with recent frequent activity.
Fire tier increases when changes are frequent in the recent window.
Fire disappears when activity stops / at final rest frame.
V1 snapshot does not show fire/tuning.
No geometry uses addedLines + deletedLines.
```

## Success criteria

- Persistent growth-based glow is removed.
- Size tracking still changes row/font size.
- Fire indicators show recent repeated activity only.
- Fire indicators are capped at 3 levels.
- Fire disappears at the final calm/rest state.
- `npm run build` passes.
