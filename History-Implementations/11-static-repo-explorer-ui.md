# Prompt: 11 — Static repository explorer UI

## Goal

Start the repository timelapse UI, but keep this pass **static**.

Create a new repo-explorer scene that visualizes the generated repository model as a side-file-explorer / Obsidian-like project structure.

This is only the visual foundation.  
No playback, no animation, no timeline controls yet.

## Current context

The preprocessing pipeline already generates:

- `data/generated/repo-animation-dataset.json`
- `data/generated/repo-animation-summary.json`
- `data/generated/repo-visual-model.json`
- `data/generated/repo-visual-model-preview.md`

Use `repo-visual-model.json` as the source for this scene.

## Very important invariant

Do **not** use total activity as visual file size.

Wrong:

```ts
visualFileSize = addedLines + deletedLines;
```

Because this would make this case wrong:

```txt
+100 / -90
```

That is high activity, but only a small final size change.

Correct:

- file visual size should come from actual file state / line count, for example:
  - `finalLineCount`
  - `maxLineCount`
  - existing visual size metadata from the visual model
  - interpolated `beforeLineCount -> afterLineCount` later, when animation is added

Activity mass / unit weight can later control:

- glow
- pulse
- event duration
- intensity

But it must **not** make the file permanently bigger.

## What to build

Add a new scene, for example:

```txt
src/scenes/RepoExplorerScene.tsx
```

It should render:

- a dark presentation frame consistent with the existing app
- a left/top title area like `Repository evolution`
- a file-explorer-style layout
- folders as compact grouped sections
- files as larger/smaller rows/cards depending on their visual size metadata
- file labels from the path/name
- subtle extension/category styling
- enough visible files to feel rich, but not cluttered

The result should look like a stylized repository explorer, not like a data table.

## Data loading

Use the safest approach for the current Vite setup.

Preferred:

- import or fetch `repo-visual-model.json` in a clean typed way
- do not hardcode the whole dataset inside React components

If Vite cannot directly load from `data/generated`, add a small documented bridge such as copying the generated model into `public/data/repo-visual-model.json`.

Do not change the preprocessing model shape unless strictly necessary.

## App wiring

Add a simple temporary way to view this scene from the app.

Acceptable options:

- replace the current main scene temporarily, or
- add a tiny scene switcher: `Document` / `Repository`

Do not remove the existing document scene code.

## Out of scope

Do **not** add:

- animation playback
- progress slider
- growth/shrink transitions
- folder growth logic
- synchronized Google Doc scene
- Remotion export
- Gource-style radial graph
- new preprocessing logic, unless only needed for JSON loading

## Success criteria

- `npm run build` passes.
- The repository scene renders from `repo-visual-model.json`.
- The layout looks like a polished static file explorer.
- File visual size is based on actual line/file-size metadata, not activity mass.
- The existing document scene is not deleted.
