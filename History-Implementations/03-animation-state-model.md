# 03 — Animation State Model for the Fake Google Doc Scene

## Goal

Implement the next layer of the presentation timelapse repo: a **data-driven progression model** for the fake Google Docs scene.

The current UI is already a static composition. Do **not** redesign it. This pass should make the scene change cleanly across thesis milestones, using explicit timeline data and simple controls.

This is not the motion-polish step yet.

---

## Current repo context

The repo already contains a Vite + React + TypeScript + Tailwind project.

Relevant current files:

```txt
src/app/App.tsx
src/scenes/FakeGoogleDocScene.tsx
src/components/presentation/PresentationStage.tsx
src/components/google-doc/DocShell.tsx
src/components/google-doc/DocTopBar.tsx
src/components/google-doc/DocumentPage.tsx
src/components/google-doc/VersionHistorySidebar.tsx
src/components/google-doc/FakeTextBlock.tsx
src/components/google-doc/CommentBubble.tsx
src/components/google-doc/StatusPill.tsx
src/data/staticDocMock.ts
```

The static scene currently shows:

- a Google-doc-like toolbar
- a document page
- fake text blocks
- comments
- a version-history sidebar
- thesis milestones such as trusted sources, manifest/versioning, extraction, BM25, assistant/citations

Preserve this visual direction.

---

## Important pre-check

Before implementing, verify the repo installs and builds.

There may be a `package-lock.json` mismatch with `package.json`. If `npm ci` fails because the lock file is out of sync, run `npm install` and keep the updated `package-lock.json`.

Validation at the end must include:

```bash
npm run lint
npm run build
```

If either fails, fix it before finishing.

---

## Required implementation

### 1. Replace the static active state with timeline data

Create a new data module:

```txt
src/data/docTimeline.ts
```

It should own the timeline model and export strongly typed data.

Suggested types:

```ts
export type DocSection = {
  id: string
  title: string
  eyebrow: string
  lineWidths: number[]
  callout?: {
    label: string
    text: string
  }
}

export type VersionEntry = {
  id: string
  label: string
  milestone: string
  description: string
}

export type DocComment = {
  id: string
  sectionId: string
  label: string
  body: string
  tone?: 'sky' | 'amber'
}

export type DocTimelineStep = {
  id: string
  label: string
  subtitle: string
  activeVersionId: string
  visibleSectionIds: string[]
  highlightedSectionIds: string[]
  visibleCommentIds: string[]
}
```

You can adjust names if needed, but keep the model simple and explicit.

Do **not** keep `active?: boolean` inside `VersionEntry`. Active state should come from the current timeline step.

---

### 2. Use this milestone progression

Use these steps as the initial timeline:

```txt
M01 Initial idea
Visible: problem
Highlight: problem

M02 Trusted sources
Visible: problem, trusted-sources
Highlight: trusted-sources

M03 Manifest storage
Visible: problem, trusted-sources, manifest-versioning
Highlight: manifest-versioning
Comment: comment-manifest

M04 Extraction baseline
Visible: problem, trusted-sources, manifest-versioning, extraction
Highlight: extraction
Comment: comment-manifest

M05 BM25 search
Visible: problem, trusted-sources, manifest-versioning, extraction, bm25-retrieval
Highlight: bm25-retrieval
Comment: comment-manifest

M06 Assistant answers
Visible: problem, trusted-sources, manifest-versioning, extraction, bm25-retrieval, assistant-citations
Highlight: assistant-citations
Comments: comment-manifest, comment-citations

M07 Presentation polish
Visible: all sections
Highlight: assistant-citations, bm25-retrieval
Comments: comment-manifest, comment-citations
```

Keep the existing thesis labels/content unless a small adjustment improves clarity.

---

### 3. Add a timeline hook

Create one small hook:

```txt
src/hooks/useDocTimeline.ts
```

It should expose:

```ts
currentStepIndex
currentStep
stepCount
canGoPrevious
canGoNext
goPrevious()
goNext()
reset()
setStepIndex(index)
```

Guard invalid indexes. Do not let the state go below `0` or above `timelineSteps.length - 1`.

This hook is only state logic. No visual styling here.

---

### 4. Derive the visible document frame

Add a pure helper, either in `docTimeline.ts` or a small helper module:

```ts
getTimelineFrame(step: DocTimelineStep)
```

It should return:

```ts
{
  sections: DocSectionWithEmphasis[]
  comments: DocComment[]
  versions: VersionEntryWithActive[]
}
```

Where:

- `sections` includes only visible sections
- highlighted sections receive `emphasis: 'highlight'`
- `comments` includes only visible comments
- `versions` marks the active version based on `step.activeVersionId`

This keeps render components simple.

---

### 5. Update the existing scene to use the hook

Update:

```txt
src/scenes/FakeGoogleDocScene.tsx
```

It should:

- call `useDocTimeline()`
- derive the current frame
- pass derived `sections`, `comments`, and `versions` into `DocShell`
- render simple timeline controls below or above the fake Google Doc frame

Do not move major layout responsibility into the scene. Keep the scene as orchestration.

---

### 6. Add minimal controls

Create:

```txt
src/components/timeline/TimelineControls.tsx
```

Controls required:

- Previous
- Next
- Reset
- current step label, e.g. `M03 · Manifest storage`
- compact step indicator, e.g. `3 / 7`

Optional but useful:

- clickable small dots for each step

Design constraints:

- controls should look like a small presentation/debug overlay
- controls must not dominate the visual scene
- controls can sit below the 16:9 stage for now
- no fullscreen mode yet
- no speed slider yet
- no autoplay yet

This pass is for correctness and state, not final presentation recording.

---

## Component changes expected

### `VersionHistorySidebar.tsx`

Change it so active state is derived from the `entries` prop.

It may keep receiving entries with an `active` field if that is the easiest derived output, but the source data must not hard-code active state anymore.

Also avoid the hard-coded `7 entries` pill. Use `entries.length`.

### `DocumentPage.tsx`

Keep the current visual style.

It should render whichever sections/comments are passed in. It should not know about timeline steps.

### `DocShell.tsx`

Keep it mostly unchanged.

It can accept an optional current step label/subtitle if useful, but do not overcomplicate it.

---

## Explicit non-goals

Do **not** implement these yet:

- autoplay
- speed slider
- keyboard controls
- Remotion export
- real Google Docs API
- Git/repository animation
- file popup animation
- frame-perfect animation timing
- large visual redesign
- route system
- backend
- persistence/localStorage

Do not introduce new libraries unless absolutely necessary. The existing `motion` dependency can stay unused for this pass.

---

## Quality expectations

- TypeScript types should be clean.
- No duplicated active-state logic spread across components.
- Data should be easy to tune later.
- Existing static look should remain recognizable.
- The app should still be understandable from a screenshot at any timeline step.
- Keep files small and focused.

---

## Acceptance criteria

The work is complete when:

1. The app starts on step 1.
2. Clicking **Next** progressively adds document sections.
3. Clicking **Previous** removes later sections.
4. Clicking **Reset** returns to step 1.
5. The version-history sidebar highlights the active milestone.
6. The document highlights the current focus section.
7. Comments appear only when their milestone is reached.
8. `npm run lint` passes.
9. `npm run build` passes.
10. The lockfile is not left inconsistent with `package.json`.

---

## Report back

When finished, summarize briefly:

- files created
- files changed
- validation commands run
- any issue found with install/build/lint
