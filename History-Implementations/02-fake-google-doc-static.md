# Codex Prompt — 02 Fake Google Doc Static Scene

You are continuing the **presentation timelapse UI** project.

The previous step created the Vite + React + TypeScript + Tailwind scaffold with a centered 16:9 presentation stage. This step should build the **static fake Google Docs scene** inside that stage.

Do **not** add timeline logic yet. Do **not** add real animations yet. Do **not** add Remotion. This prompt is only about making one static frame look good enough for a thesis presentation screenshot.

## Goal

Create a polished static UI mock inspired by a Google Docs document with a version-history sidebar.

The scene should communicate:

> A thesis/design document is evolving over time.

It should look like a believable productivity/document editor interface, but it must be clearly custom-made and lightweight. Do not copy Google branding, logos, exact icons, or pixel-perfect Google Docs UI.

## Context

This animation will later be a short visual interlude in a thesis presentation. The final idea is a timelapse where:

- a fake document grows and reorganizes,
- version-history entries activate over time,
- thesis milestones appear,
- later scenes may synchronize with a repository/file-growth animation.

For now, build only the static fake document scene.

## Existing structure

Keep the existing structure from step 01. Extend it cleanly.

Expected structure after this step:

```text
src/
  app/
    App.tsx
  scenes/
    PlaceholderScene.tsx        # can be removed or no longer used
    FakeGoogleDocScene.tsx
  components/
    presentation/
      PresentationStage.tsx
    google-doc/
      DocShell.tsx
      DocTopBar.tsx
      DocumentPage.tsx
      VersionHistorySidebar.tsx
      FakeTextBlock.tsx
      CommentBubble.tsx
      StatusPill.tsx
  data/
    staticDocMock.ts
  styles/
    globals.css
```

If the current scaffold differs slightly, adapt without over-engineering.

## Visual requirements

### 1. Overall scene

Inside the 16:9 stage, render a full fake document editor layout:

```text
┌──────────────────────────────────────────────┐
│ fake top bar / toolbar                        │
├───────────────────────────────┬──────────────┤
│ document workspace             │ versions     │
│                               │ sidebar      │
│ centered paper page            │              │
└───────────────────────────────┴──────────────┘
```

Style direction:

- clean, modern, presentation-friendly
- soft shadows
- rounded corners
- subtle borders
- light document page on a muted workspace
- right sidebar slightly tinted
- no harsh colors
- no clutter

### 2. Top bar

Create a fake editor top bar with:

- document title: `Thesis Design Notes`
- small status text: `Saved · Presentation mock`
- a few fake toolbar chips/buttons, e.g. `Outline`, `Sources`, `Citations`
- a small right-side pill: `Version history`

Do not use real Google logo or Google Docs branding.

### 3. Document page

Create a centered document page with fake thesis content.

Use a mix of readable headings and fake blurred/skeleton-like text blocks.

Readable headings should include a few of these:

```text
Problem
Trusted UniTN Sources
Manifest & Versioning
Extraction
BM25 Retrieval
Assistant with Citations
```

The body text should mostly be fake/placeholder blocks. Avoid long real paragraphs. This is a visual scene, not a readable report.

The page should include:

- title at the top
- 4–6 section blocks
- fake text lines of varying widths
- 1–2 highlighted phrases or cards
- 1–2 margin comments

### 4. Version-history sidebar

Create a right sidebar with the title:

```text
Version history
```

Include 5–7 fake version entries, for example:

```text
Initial idea
Trusted sources
Manifest storage
Extraction baseline
BM25 search
Assistant answers
Presentation polish
```

Each entry should have:

- label
- small fake date or milestone number
- tiny dot/indicator
- optional short description

Make one entry visually active, for example:

```text
BM25 search
```

This active state will later be driven by timeline state, but for now it is hardcoded.

### 5. Comments and highlights

Add a small number of presentation-friendly details:

- one comment bubble near `Manifest & Versioning`
- one comment bubble near `Assistant with Citations`
- one highlighted section or phrase around `BM25 Retrieval`

Keep them decorative and subtle. Do not cover the document too much.

### 6. Responsive / presentation constraints

The scene must be optimized for a 16:9 recording area.

Requirements:

- looks good around 1920×1080
- still usable on a laptop screen
- no page-level scroll required for the main stage
- sidebar should not overflow vertically
- text can be small but not unreadable
- avoid creating a huge DOM tree

## Data model

Create a simple static data file:

```ts
// src/data/staticDocMock.ts

export const docSections = [...];
export const versionEntries = [...];
export const comments = [...];
```

Use typed objects. Keep the types simple and local or exported from the same file.

Example direction:

```ts
export type DocSection = {
  id: string;
  title: string;
  emphasis?: boolean;
  lineWidths: number[];
};
```

Do not create a timeline model yet. That belongs to the next prompt.

## Component guidance

### `FakeGoogleDocScene.tsx`

Responsible for composing the whole scene.

### `DocShell.tsx`

Responsible for the fake editor container and two-column layout.

### `DocTopBar.tsx`

Responsible for the top bar only.

### `DocumentPage.tsx`

Responsible for rendering the fake paper/document.

### `VersionHistorySidebar.tsx`

Responsible for rendering version entries.

### `FakeTextBlock.tsx`

Small reusable component for fake text lines.

### `CommentBubble.tsx`

Small decorative comment bubble.

### `StatusPill.tsx`

Reusable pill/chip if useful.

Do not make components too abstract. This is a presentation scene, not a general UI library.

## App integration

Update `App.tsx` so the stage renders `FakeGoogleDocScene` instead of the placeholder scene.

Keep `PresentationStage` as the outer 16:9 container if it already exists and works.

The final app should open directly to the fake Google Doc scene.

## Styling rules

Use Tailwind classes primarily.

Avoid:

- global CSS except for base styles if already present
- external component libraries
- exact Google branding
- complicated CSS animations
- canvas/WebGL/SVG-heavy effects

Allowed:

- lucide icons only if already installed or if adding it is very useful
- simple inline SVG icons if easier
- CSS gradients and shadows
- `backdrop-blur` sparingly

If adding an icon dependency, keep it justified. Otherwise use text/chips/simple shapes.

## Non-goals for this prompt

Do **not** implement:

- animated progression
- play/pause controls
- previous/next controls
- speed slider
- keyboard shortcuts
- real Google Docs data
- Git/repository visualization
- Remotion export
- screen recording logic
- actual Google Docs API integration

## Robustness expectations

- TypeScript compiles without errors.
- `npm run build` passes.
- No unused imports.
- No console errors.
- No unnecessary state management.
- No fake backend.
- No routing.
- No real network calls.

## Suggested implementation steps

1. Inspect the current scaffold from step 01.
2. Add the `google-doc` components.
3. Add `src/data/staticDocMock.ts`.
4. Build the static layout inside `FakeGoogleDocScene.tsx`.
5. Replace the placeholder scene in `App.tsx`.
6. Tune spacing for a 16:9 stage.
7. Run formatting/linting if available.
8. Run `npm run build`.

## Acceptance criteria

The implementation is successful when:

```bash
npm run build
npm run dev
```

work without errors, and the browser shows a polished fake Google Docs / version-history scene that already looks good as a static screenshot.

## Final response expected from Codex

After implementing, report briefly:

- files created/changed
- commands run
- whether `npm run build` passed
- a short note on how the static scene is structured
- anything intentionally deferred to the next prompt

Do not start implementing the next prompt.
