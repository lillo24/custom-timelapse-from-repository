# Prompt 28: Repo Explorer V2 small visual fixes

## Goal

Fix three small Repo Explorer V2 visual issues:

1. Size-tracked folders like `extract` and `retrieval` must not start smaller than normal explorer rows.
2. File/folder names should align slightly higher relative to the connector lines.
3. At the end of playback, recent glow should fade/clear instead of staying stuck on the final step.

Also add a small tuning-panel helper button to set the base font to the normal explorer font size: **13px = 0.8125rem**.

Work mainly in:

```txt
src/scenes/RepoExplorerScene.tsx
repo-animation.config.json
display model config defaults/types if needed
```

Do not change preprocessing logic unless needed for defaults/config shape.

---

## 1. Fix tracked-node base font size

The normal explorer rows visually use about `13px`.

Since root rem is normally `16px`:

```txt
13 / 16 = 0.8125rem
```

So the default `baseFontSizeRem` for size-tracked nodes should be:

```json
"baseFontSizeRem": 0.8125
```

Right now tracked nodes can start smaller than the normal explorer text, probably because the default/config is around:

```json
"baseFontSizeRem": 0.72
```

which is only:

```txt
0.72rem * 16 = 11.52px
```

### Required changes

- Update the default `sizeTrackingStyle.baseFontSizeRem` to `0.8125`.
- Update `repo-animation.config.json` if it currently uses a smaller value.
- Update React fallback defaults too, not only the config.
- Add a short code/config comment explaining:
  ```txt
  0.8125rem = 13px at the browser default 16px root font size.
  ```

### Important

Tracked nodes should start at the same font size as untracked rows when their line-ratio is zero or near zero.

Only growth should make them larger.

---

## 2. Add tuning-panel button: “Set base font 13px”

In the Repo Explorer V2 live tuning panel, add a small helper button:

```txt
Set base font 13px
```

When clicked, it should set:

```ts
baseFontSizeRem = 0.8125
```

This should update the live tuning state immediately and persist through the existing localStorage tuning override system.

Do not show this button in the frozen V1 scene.

Keep it small. It can be near the `baseFontSizeRem` control.

---

## 3. Align names slightly higher relative to connector lines

The explorer connector lines currently look slightly low/misaligned against file/folder labels.

Adjust the row label alignment so file/folder names sit a bit higher relative to the connector/elbow lines.

Possible approaches:

```txt
- slightly reduce/adjust row line-height
- apply a tiny negative translateY to the label text, e.g. -1px
- adjust connector pseudo-element vertical position
```

Use the smallest clean CSS change.

Do not redesign the connector-line system.

Do not reintroduce icons.

Do not break row height/growth behavior.

Success target:

```txt
Names visually align with the horizontal connector branch, sitting slightly higher than now.
```

---

## 4. Clear/fade recent glow at the end of playback

Currently, when playback reaches the final unit, the last edited files/folders can stay glowing forever.

Fix this so the final state can become calm/no-glow.

Preferred behavior:

```txt
When autoplay reaches the end, add/enter a final no-glow resting state.
```

Implementation options:

### Option A: virtual end/rest frame

Allow the selected playback position to go one extra step beyond the last timeline unit:

```txt
last timeline unit + rest frame
```

At this rest frame:

```txt
visible repo state = final repo state
recent activity window = empty
glow intensity = 0
```

### Option B: explicit glow fade timer

When reaching the end, keep final file state but let recent glow decay/clear.

### Preference

Use Option A if it fits the current slider/playback model cleanly.

The slider/control label can show something like:

```txt
Complete
```

or simply clamp labels gracefully.

Do not create fake file changes. This is only a visual no-glow end state.

### Requirements

- Final repo structure remains visible.
- No recent-glow highlight remains stuck forever.
- Reset/play/manual slider still works.
- If the user manually drags back before the end, recent glow behaves normally again.
- If the user drags to the final rest state, glow is cleared.

---

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

---

## V1 safety

Do not change the frozen V1 snapshot data.

The V1 scene should stay clean:

```txt
/data/snapshots/repo-display-model-v1.json
```

The tuning panel and 13px helper button should only appear in the live Repository / V2 scene.

If V1 shares the same React component, make sure:

```tsx
enableTuningPanel={false}
```

or equivalent still disables it.

---

## Constraints

- Do not change raw Git extraction.
- Do not change file-state reconstruction.
- Do not change change-unit generation.
- Do not change visual-model generation.
- Avoid preprocessing changes unless only updating config defaults/types/comments.
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

If config/defaults changed and generated data should be refreshed, also run:

```bash
npm run build:animation-data -- --repo ../thesis-disi-chatbot --config repo-animation.config.json
npm run build
```

Browser check:

```txt
Tracked extract/retrieval do not start smaller than normal rows.
The tuning panel has a “Set base font 13px” helper.
Clicking it sets baseFontSizeRem to 0.8125 and persists.
File/folder labels align slightly better/higher with connector lines.
At playback end, glow clears/fades instead of staying stuck.
V1 snapshot still has no tuning panel and still works.
No geometry uses addedLines + deletedLines.
```

## Success criteria

- `baseFontSizeRem` default/config/fallback is `0.8125`.
- Code/config includes a small comment that `0.8125rem = 13px`.
- Live tuning panel can set base font to 13px.
- Connector-line text alignment is improved.
- Final playback has a calm no-glow end state.
- `npm run build` passes.
