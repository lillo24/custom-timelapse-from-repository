# 07 — Word-like document chrome polish

## Context

We are building a presentation-only React mock that shows a document evolving over milestones.
The current fake Google Docs-style chrome was removed/cleaned in the previous pass.
Now the scene should look more like a real document editor / Microsoft Word-style writing environment.

A reference file will be placed in the repo root:

```txt
Document.mhtml
```

Use it only as a **visual reference** for the kind of toolbar density and document-editor feeling we want.
Do **not** attempt to exactly clone Microsoft Word, copy proprietary icons/assets, or depend on the MHTML at runtime.
Build an original, simplified “Word-like” ribbon using React/CSS.

## Goal

Add a compact, believable document-editor toolbar above the white document page.
The document itself should remain a simple clean white page/rectangle.
The result should feel like a polished thesis-design document being edited, not like a dashboard.

## User-facing requirements

### 1. Add a Word-like top ribbon

Create a new reusable component, for example:

```txt
src/components/document-editor/WordLikeRibbon.tsx
```

or equivalent, matching the current project structure.

The ribbon should include a few stereotypical editor controls:

- clipboard/paste group
- font selector dropdown-like pill, e.g. `Aptos (Body)` or `Aptos (Corpo)`
- font size selector, e.g. `12`
- bold / italic / underline / strikethrough
- subscript / superscript
- text highlight
- text color
- bullet list / numbered list
- align left / center / right / justify
- indentation controls
- paragraph symbol / show formatting button

The controls do **not** need to work.
They are visual only.
Use simple text, CSS shapes, Unicode symbols, or already-installed icon libraries if available.
Do not add a heavy icon dependency unless the repo already uses one.

### 2. Make it look like document software, not a web app toolbar

The ribbon should have:

- light neutral background
- subtle bottom border
- grouped sections with thin vertical separators
- small labels under some groups, such as `Clipboard`, `Font`, `Paragraph`
- compact spacing
- disabled/non-interactive cursor behavior where appropriate

It should be visually close to the provided screenshot/reference, but not a pixel-perfect copy.

### 3. Keep the document simple

The main document area should stay:

- centered
- white
- page-like
- with subtle shadow/border
- with the existing animated/fake document content inside

Do not add unnecessary sidebars.
Do not reintroduce the old version-history sidebar.
Do not add a second duplicate milestone indicator.
The bottom controls remain the only timeline/milestone controls.

### 4. Fit everything in the viewport

This is important.
The page must not show accidental browser scrollbars.
The bottom dots / next / previous controls must not overflow below the viewport.

Use a layout like:

```txt
root scene: height: 100dvh; overflow: hidden;
  ribbon: fixed/content height
  document stage: flex: 1; min-height: 0;
  controls: fixed/content height inside viewport
```

The document page may scale down slightly if needed.
Do not solve overflow by hiding important controls off-screen.

### 5. Preserve existing timeline behavior

Do not rewrite the milestone state model.
Do not change the existing timeline data unless needed for labels.
Do not change the existing animation sequencing.
This pass is mainly visual/layout polish.

## Implementation constraints

- Keep TypeScript strict-compatible.
- Avoid unused imports, unused props, and dead components.
- Keep components small and readable.
- Prefer CSS/Tailwind classes already used by the repo.
- Do not introduce Remotion.
- Do not introduce autoplay or speed controls in this pass.
- Do not introduce real document editing behavior.
- Do not depend on `Document.mhtml` at runtime.

## Suggested implementation steps

1. Inspect the current scene/component structure.
2. Inspect `Document.mhtml` or the screenshot only to understand the visual target.
3. Add a `WordLikeRibbon` component.
4. Place it at the top of the main scene.
5. Recalculate the main layout so ribbon + document + bottom controls all fit inside `100dvh`.
6. Remove/adjust any old top chrome that conflicts with the new ribbon.
7. Run the project checks.

## Validation

Run:

```bash
npm install
npm run dev
npm run build
```

If the repo has lint/typecheck scripts, also run them.

Manually verify:

- no vertical scrollbar in the browser window
- no bottom overflow from dots/buttons
- ribbon is visible and compact
- document page still looks clean and centered
- milestones still change the document content
- no version-history/sidebar timeline was reintroduced

## Success definition

The scene should now look like a clean animated thesis document inside a believable Word-like editor shell.
It should be immediately understandable in a presentation recording, without duplicated sidebars or clutter.
