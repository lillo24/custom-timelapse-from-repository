# 06 — Clean Fake Google Doc Scene Layout

## Context

This repo is a React/Vite/TypeScript presentation animation project.

The current scene already has:

- a fake Google Docs-style document
- milestone-driven document state
- animated document sections/comments/highlights
- bottom timeline controls
- hide/show controls behavior
- keyboard controls

The next problem is visual redundancy and layout clutter.

The scene currently shows duplicate navigation/chrome:

1. A fake Google Docs top row:

```txt
Thesis Design Notes
Saved · Presentation mock
Outline
Sources
Citations
Version history
```

This row is not useful for the presentation animation and should be removed completely.

2. A right sidebar timeline/version-history rail:

```txt
Timeline rail
Version history
The active checkpoint follows the current milestone while the rest keep the thesis arc readable at a glance.
7 entries
M01 Initial idea Active
M02 Trusted sources
...
```

This is also redundant because the bottom controls already show the current milestone and step position.

Important: the visual should become simpler and more cinematic, not more dashboard-like.

---

## Goal

Remove the useless fake Google Docs chrome and right timeline/sidebar, then make the document area use the freed space cleanly.

By the end:

- The fake top toolbar/header row is gone.
- The right version-history/timeline sidebar is gone.
- The document/page remains centered and visually strong.
- The bottom controls remain the only milestone navigation UI.
- No page scrollbar or bottom overflow returns.
- The scene still builds cleanly with TypeScript and ESLint.

---

## Scope

Implement only:

1. Remove the fake Google Docs top row from the rendered scene.
2. Remove the right timeline/version-history sidebar from the rendered scene.
3. Simplify `DocShell` layout to a single main document canvas.
4. Rebalance spacing/scale after removing the sidebar.
5. Keep bottom controls compact and inside the viewport.
6. Clean up unused imports/types/props caused by the removal.

Do **not** add:

- autoplay
- speed slider
- Remotion
- MP4 export
- repository/file-tree animation
- new routes
- real Google Docs API data
- a new visual concept
- a new sidebar replacement

---

## Required changes

### 1. Remove the rendered top row

The following visible row must disappear completely:

```txt
Thesis Design Notes
Saved · Presentation mock
Outline
Sources
Citations
Version history
```

Likely implementation:

- Stop rendering `DocTopBar` inside `DocShell`.
- Remove the `DocTopBar` import from `DocShell`.
- If `documentTitle` is only passed to `DocTopBar` at shell level, simplify the prop flow as needed.

Do not replace it with another toolbar.

The document title can still appear inside the document page itself if already present there.

---

### 2. Remove the rendered right sidebar

The following sidebar must disappear completely:

```txt
Timeline rail
Version history
The active checkpoint follows the current milestone while the rest keep the thesis arc readable at a glance.
7 entries
M01 ...
M02 ...
```

Likely implementation:

- Stop rendering `VersionHistorySidebar` inside `DocShell`.
- Remove the `VersionHistorySidebar` import from `DocShell`.
- Remove the `versions` prop from `DocShell` if it is only used for the sidebar.
- Update the caller in `FakeGoogleDocScene` so it no longer passes `versions` to `DocShell`.
- Do not create a new side rail. The bottom `TimelineControls` is enough.

It is fine to leave the `VersionHistorySidebar.tsx` file in the repo for now if deleting it would make the diff noisier. But it must not be rendered.

---

### 3. Convert `DocShell` to a single-column stage

After removing the sidebar, `DocShell` should no longer use a two-column grid like:

```tsx
grid-cols-[minmax(0,1fr)_15rem]
```

Instead, make it a clean single document stage.

Preferred shape:

```tsx
<div className="flex h-full flex-col overflow-hidden rounded-[30px] ...">
  <div className="relative min-h-0 flex-1 overflow-hidden ...">
    <background effects />
    <div className="relative flex h-full items-center justify-center ...">
      <DocumentPage ... />
    </div>
  </div>
</div>
```

The shell should feel like a large presentation card containing the evolving document.

---

### 4. Rebalance the document size

With the sidebar gone, the document may look too small or awkwardly spaced.

Adjust only what is necessary:

- Let the document page use more horizontal space.
- Keep it centered.
- Keep margins/padding clean.
- Avoid making the document touch the stage edges.
- Avoid huge empty space.

Likely places:

- `DocShell.tsx`
- `DocumentPage.tsx`
- `PresentationStage.tsx`
- `FakeGoogleDocScene.tsx`

Suggested direction:

- The document page can have a max width around `820px`–`920px` if it fits well.
- The outer shell should remain bounded inside the 16:9 presentation stage.
- Keep the right-side comment column if it still looks good, but it must not cause overflow.

Do not over-optimize. The main criterion is: it should look good as one recorded slide frame.

---

### 5. Preserve the bottom controls

The bottom controls remain useful and should stay.

They should still show:

- current milestone label
- step count, e.g. `3 / 7`
- dots
- previous/next/reset controls

But they must stay compact and must not overflow out of the stage or browser viewport.

If the removal changes layout height, verify that the previous no-scroll fix still holds.

Acceptance checks:

- Browser page has no vertical scrollbar.
- Browser page has no horizontal scrollbar.
- Controls are visible at the bottom and not clipped.
- Hiding controls still works.
- Showing controls again does not push content outside the viewport.

---

### 6. Clean TypeScript issues

The project has strict TypeScript settings, including unused-locals checks.

After removing rendered components/props, clean up:

- unused imports
- unused props
- unused type imports
- stale prop definitions
- stale references to `versions` if no longer needed by rendered UI

Important likely files:

- `src/components/google-doc/DocShell.tsx`
- `src/scenes/FakeGoogleDocScene.tsx`
- `src/components/google-doc/DocTopBar.tsx` if edited/deleted
- `src/components/google-doc/VersionHistorySidebar.tsx` if edited/deleted
- `src/data/docTimeline.ts` only if types become awkward, but avoid large data rewrites

Do not break the timeline data model unless necessary.

---

## Implementation guidance

Before editing:

1. Inspect the current `DocShell.tsx`.
2. Confirm where `DocTopBar` is rendered.
3. Confirm where `VersionHistorySidebar` is rendered.
4. Inspect `FakeGoogleDocScene.tsx` to update `DocShell` props.
5. Check whether the bottom controls still reserve enough space.

Expected direction:

```tsx
<DocShell
  documentTitle={documentTitle}
  sections={frame.sections}
  comments={frame.comments}
/>
```

Not:

```tsx
<DocShell
  documentTitle={documentTitle}
  sections={frame.sections}
  comments={frame.comments}
  versions={frame.versions}
/>
```

The sidebar versions can still exist in `docTimeline.ts` for future use, but they should not be passed to rendered components unless needed.

---

## Quality checks

Run:

```bash
npm install
npm run build
npm run lint
npm run dev
```

Manual checks:

1. The top row with `Thesis Design Notes`, `Saved · Presentation mock`, `Outline`, `Sources`, `Citations`, `Version history` is gone.
2. The right `Timeline rail / Version history` sidebar is gone.
3. The bottom timeline controls are still present.
4. The document looks centered and larger/cleaner than before.
5. No page scrollbar appears at 100% browser zoom.
6. No horizontal scrollbar appears.
7. The bottom controls do not overflow below the viewport.
8. `ArrowRight` and `ArrowLeft` still work.
9. `Home` and `End` still work.
10. `H` still hides/shows the controls.
11. Motion animations still work when moving between milestones.
12. Build and lint pass.

---

## Non-goals

Do not tune thesis content in this pass.
Do not add the repository/file popup animation yet.
Do not add export/rendering tooling yet.

This pass is successful when the fake Google Doc animation has one clear visual focus: the evolving document, with only compact bottom controls for navigation.
