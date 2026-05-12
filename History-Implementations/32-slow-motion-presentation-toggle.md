# Prompt 32: Add slow-motion presentation toggle to Repo Explorer

## Goal

Add a simple **slow-motion mode** to the live Repository / Repo Explorer scene.

This is for presentation/pitch explanations: while the animation is running, I should be able to click one button and make the whole replay slow down until I click it again.

This is a UI-only feature.

Do not change preprocessing.

---

## Desired behavior

Add a small button to the existing floating playback controls:

```txt
Slow motion
```

or shorter:

```txt
Slow
```

When inactive:

```txt
playback uses the normal selected duration/speed settings
```

When active:

```txt
playback runs much slower
```

Clicking the button again returns to normal playback speed.

---

## Speed logic

Implement slow mode as an extra multiplier on top of the existing duration/speed controls.

Example:

```ts
effectivePlaybackSpeed = selectedPlaybackSpeed * slowMotionMultiplier
```

Suggested default:

```ts
slowMotionMultiplier = 0.2
```

So:

```txt
1x speed + slow mode => 0.2x effective speed
2x speed + slow mode => 0.4x effective speed
0.5x speed + slow mode => 0.1x effective speed
```

Do not permanently change the selected speed button.

The selected speed remains what the user chose; slow mode is a temporary modifier.

---

## UI placement

Put the button in the existing floating playback controls.

It should be available in both vertical and horizontal control layout.

Keep it compact.

Suggested labels:

```txt
Slow
```

Inactive state:

```txt
Slow
```

Active state:

```txt
Slow on
```

or use a small visual active style.

Do not make a large panel.

---

## Interaction requirements

Slow mode should work while:

```txt
animation is playing
animation is paused
user changes duration
user changes speed
user drags the slider
user resets
```

If slow mode is active and the user changes speed, slow mode should remain active and apply to the new speed.

Reset should not necessarily disable slow mode. Prefer keeping slow mode as a user toggle until clicked off.

---

## Final rest frame

Keep the existing final calm/rest behavior.

Slow mode should only affect how fast the animation reaches the end.

It should not break:

```txt
final no-glow state
fire disappearing at the end
line counter final totals
```

---

## V1 safety

Do not change the frozen Repository V1 snapshot data.

If the V1 scene uses the same playback controls, it is okay if the slow-motion button appears there too, but prefer only adding it to the live Repository scene if that is cleaner.

Do not change V1 data or preprocessing.

---

## Constraints

- UI-only change.
- Work mainly in `src/scenes/RepoExplorerScene.tsx` or the playback control component if split out.
- Do not change Git extraction.
- Do not change display-model generation.
- Do not change `repo-animation.config.json`.
- Do not touch the document/Word scene.
- Do not reintroduce scrollbars as a solution.
- Keep TypeScript/build clean.

---

## Validation

Run:

```bash
npm run build
```

Browser check:

```txt
Play normally at 30s + 1x.
Click Slow: animation visibly slows down.
Click Slow again: animation returns to normal speed.
Changing speed while Slow is active still applies slow multiplier.
Reset does not break slow mode.
Final rest/no-glow frame still works.
Line counter still updates correctly.
```

## Success criteria

- Slow-motion toggle exists in the floating playback controls.
- Slow mode applies an extra multiplier to playback speed.
- Slow mode can be toggled on/off during playback.
- Existing duration/speed controls still work.
- `npm run build` passes.
