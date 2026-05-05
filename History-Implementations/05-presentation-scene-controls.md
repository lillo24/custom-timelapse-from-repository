# 05 — Presentation Scene Controls + No-Scroll Recording Layout

## Context

This repo is a small React/Vite/TypeScript project for a thesis presentation animation.
The current scene is a fake Google Docs-style document with a version-history sidebar and manual timeline controls.

The goal of this pass is to make the scene safe to screen-record and present.

Important current problem:
- The page currently has a scrollbar/overflow effect.
- Specifically, the dots/next/previous controls below the document skeleton overflow past the bottom of the viewport.
- This must be fixed in this pass.

Do not redesign the whole scene. Keep the current visual direction and component structure as much as possible.

---

## Goal

Make the scene fit cleanly inside the browser viewport with no accidental page scrolling, and make the controls usable without breaking the 16:9 presentation frame.

By the end:
- The app must render without vertical or horizontal page scrollbars at normal laptop/desktop sizes.
- Timeline controls must not overflow below the scene.
- The fake Google Doc scene must remain centered and presentation-ready.
- There should be a clean way to hide/show controls for recording.

---

## Scope

Implement only:

1. Viewport-safe layout
2. Fix control overflow
3. Recording/presentation mode toggle
4. Minimal keyboard controls
5. Small layout polish needed to support the above

Do **not** add:
- Remotion
- MP4 export
- repo/file-tree animation
- autoplay timeline
- speed slider
- real Google Docs API data
- new major visual redesign
- new route system

---

## Required behavior

### 1. No page scrollbars

The root app should occupy the viewport cleanly.

Requirements:
- `html`, `body`, and `#root` should use full viewport height.
- Avoid accidental `min-height` + padding combinations that exceed `100vh`.
- The scene wrapper should use a bounded height such as `h-screen`, `max-h-screen`, or equivalent.
- Set overflow intentionally. Prefer the app shell having `overflow-hidden`.
- No vertical scrollbar should appear just because controls are below the scene.
- No horizontal scrollbar should appear.

Acceptance check:
- Run `npm run dev`.
- Open the app.
- At 100% browser zoom, the browser page should not scroll.
- The bottom controls should remain visible.

### 2. Fix the timeline controls overflow

Current issue:
- The dots/next buttons are below the doc skeleton and overflow out of the viewport.

Fix options are allowed, but prefer one of these:

Option A — integrate controls inside the presentation stage:
- Put controls in a compact bottom overlay inside the stage.
- Use absolute positioning within the scene frame.
- Use a subtle glass/blur panel.
- Keep enough bottom padding inside the stage so controls do not cover important content.

Option B — reserve a small footer inside the viewport:
- The page layout becomes: scene area + compact controls footer.
- The scene area shrinks to fit.
- The combined height must never exceed the viewport.

Choose the option that best fits the current code with the smallest safe change.

Controls should be compact:
- Previous button
- dots / step indicators
- Next button
- Reset button if already present
- Current milestone label if already present or easy to keep

Avoid tall button rows.

### 3. Add recording mode

Add a simple way to hide controls for screen recording.

Implementation suggestion:
- Add local state: `isRecordingMode` or `showControls`.
- Add a small button such as `Hide controls` / `Show controls`.
- When controls are hidden, the fake Google Doc scene should occupy the cleaned-up presentation space.
- The scene must still not cause scrollbars.

Keyboard shortcut:
- `H` toggles controls visibility.

### 4. Add minimal keyboard controls

Add keyboard support:
- `ArrowRight` = next milestone
- `ArrowLeft` = previous milestone
- `Home` = first milestone
- `End` = last milestone
- `H` = hide/show controls

Guardrails:
- Do not trigger shortcuts while typing in an input, textarea, or editable element.
- Prevent shortcuts from causing unwanted page scrolling when appropriate.
- Clean up event listeners correctly.

### 5. Keep the scene presentation-friendly

The visual should feel like a slide/recording stage, not a normal scrollable webpage.

Prefer:
- dark/neutral outer background
- centered scene frame
- stable 16:9-ish stage
- no layout jump when moving between milestones
- controls that feel secondary

Do not make it look like a dashboard.

---

## Implementation guidance

Likely files to inspect/edit:

- `src/app/App.tsx`
- `src/scenes/FakeGoogleDocScene.tsx`
- `src/styles/globals.css` or equivalent global stylesheet
- any existing timeline/control component created in the previous pass

Before editing:
1. Inspect the current file structure.
2. Identify where the timeline controls are rendered.
3. Identify where the root viewport/stage layout is defined.
4. Make the smallest robust change.

---

## CSS/layout hints

Use these ideas only if they fit the existing code:

```css
html,
body,
#root {
  width: 100%;
  height: 100%;
  margin: 0;
}

body {
  overflow: hidden;
}
```

For the app shell:

```tsx
<div className="h-screen w-screen overflow-hidden bg-slate-950">
  ...
</div>
```

For a bounded stage:

```tsx
<div className="relative aspect-video w-full max-w-[1600px] max-h-[calc(100vh-2rem)] overflow-hidden rounded-3xl">
  ...
</div>
```

For overlay controls:

```tsx
<div className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2">
  ...
</div>
```

Do not copy blindly. Adapt to the existing code.

---

## Quality checks

After implementation, run:

```bash
npm install
npm run build
npm run dev
```

Then manually check:

1. No browser scrollbar at 100% zoom.
2. No horizontal scrollbar.
3. Dots/next/previous controls are visible and not clipped.
4. Controls do not overflow below the viewport.
5. Arrow keys move between milestones.
6. `H` hides/shows controls.
7. Hidden-controls mode is good enough for screen recording.
8. The animation still works after the layout changes.

---

## Non-goals

Do not solve future export or advanced timing here.

This pass is successful when the existing fake Google Docs animation can be opened full-screen and recorded without scrollbars or bottom overflow.
