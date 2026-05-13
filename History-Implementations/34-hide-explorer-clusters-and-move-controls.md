# Prompt 34: Hide Explorer Clusters with placeholder + move controls into Tune panel

## Goal

Make the middle/right `Explorer Clusters` container temporarily hideable, without breaking the overall layout.

When hidden, do **not** just remove the area completely. Keep an empty placeholder/slot so the file explorer does not jump or become badly positioned.

Also move two controls into the existing `Tune` panel:

1. Toggle to hide/show the Explorer Clusters container.
2. Toggle to choose the line counter version.

Work mainly in:

```txt
src/scenes/RepoExplorerScene.tsx
```

Do not change preprocessing.

---

## 1. Hide/show the Explorer Clusters container

Find the container with this class:

```tsx
grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto pr-1 2xl:grid-cols-2 [scrollbar-width:thin] [scrollbar-color:rgba(51,65,85,0.55)_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700/45 [&::-webkit-scrollbar-thumb:hover]:bg-slate-600/55
```

This is the Explorer Clusters scroll/grid area.

Add a live UI state:

```ts
showExplorerClusters: boolean
```

Default:

```ts
true
```

When `showExplorerClusters` is true, render the existing Explorer Clusters content exactly as now.

When false, replace the content with an empty placeholder occupying the same layout slot.

The placeholder should be invisible/minimal:

```txt
no title
no card chrome
no border
no strong background
no cluster cards
```

But it should preserve enough layout width/space so the file explorer remains visually positioned correctly.

---

## 2. Put the hide/show control inside the Tune panel

In the existing live V2 `Tune` panel, add a small toggle:

```txt
Explorer clusters: Show / Hide
```

or:

```txt
Show clusters
```

This control should only appear in the live Repository / V2 scene.

Do not show it in the frozen V1 scene.

Persisting this in localStorage is optional. If the existing tuning panel already persists similar UI settings cleanly, include it. Otherwise local state is enough.

---

## 3. Move line counter version toggle into Tune panel

There is already a toggle/button somewhere for choosing the line counter version.

Move that control into the same `Tune` panel.

Do not duplicate it.

Do not leave the old copy outside.

The Tune panel should contain:

```txt
visual tuning controls
fire tuning controls
show/hide Explorer Clusters
line counter version toggle
```

Keep the panel compact.

---

## 4. Layout behavior

The main goal is:

```txt
hide Explorer Clusters visually
but preserve the overall scene balance
```

If using an empty placeholder makes the explorer still centered/positioned well, use that.

If a small layout change is cleaner, that is okay, but do not make the file explorer stretch weirdly across the whole screen unless explicitly intended.

Do not reintroduce big wrapper cards/panels.

Do not add scrollbars as the solution.

---

## 5. V1 safety

Do not change the frozen V1 snapshot data.

The V1 scene should stay clean.

If V1 shares the same component, ensure:

```tsx
enableTuningPanel={false}
```

or equivalent still hides the Tune panel and these controls.

---

## Constraints

- Do not change preprocessing.
- Do not change display-model generation.
- Do not touch the document/Word scene.
- Do not reintroduce `+ N more`.
- Do not reintroduce `collapseFolders`.
- Do not break connector lines.
- Do not change fire/heat logic except for layout side effects if needed.
- Keep TypeScript/build clean.

---

## Validation

Run:

```bash
npm run build
```

Browser check:

```txt
Tune panel has a Show/Hide Explorer Clusters toggle.
Hiding clusters removes the visible cluster content.
An empty placeholder/slot remains so the file explorer positioning does not break.
Showing clusters restores the old cluster content.
Line counter version toggle is now inside Tune.
No duplicate line counter toggle remains outside.
V1 scene remains clean and unchanged.
```

## Success criteria

- Explorer Clusters can be hidden from the Tune panel.
- Hidden state keeps an invisible placeholder/layout slot.
- Line counter version control lives in the Tune panel.
- No preprocessing changes.
- `npm run build` passes.
