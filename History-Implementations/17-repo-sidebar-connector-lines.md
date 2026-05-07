# Prompt 17: Add Reddit-style connector lines to the repo sidebar tree

## Goal

Improve only the left repository sidebar tree.

Right now the tree still looks too icon-based: some rows have `v`, some lowest-level rows have square markers. I want the nesting to be shown with **thin connector lines**, similar to Reddit nested comment threads.

Use the attached Reddit files only as a **visual reference** for the connector-line idea:

- `reddit-commentlists.html`
- `comment-section-reddit.mhtml`

Do not copy Reddit components, class names, CSS variables, or DOM structure.

## What to change

Replace the current folder/file leading icons with custom tree connector lines.

The sidebar should feel like this:

```txt
src
│  app
│  │  App.tsx
│  scenes
│  │  RepoExplorerScene.tsx
scripts
│  build-animation-data.ts
```

But rendered cleanly in React/CSS, not as text characters.

## Visual rules

- Keep the flat vertical explorer list from the previous step.
- One row per visible file/folder node.
- Indentation still shows depth.
- Add thin vertical guide lines for ancestor levels.
- Add a small horizontal/elbow connector from the active depth line into the row label.
- Remove the current `v` / square / icon markers before names.
- Do not add file-type icons yet.
- Do not add expand/collapse logic yet.
- Keep depth limit behavior as it is now, around depth 4.
- Keep rows compact, like a real file explorer.

## Important constraints

- Change only the repo sidebar tree rendering/styling.
- Do not touch the document scene.
- Do not touch preprocessing scripts.
- Do not change playback, slider, speed, or current-line-count sizing logic.
- Do not bring back folder cards, counters, progress bars, or bordered containers.
- Do not use activity mass for geometry.
- Keep `npm run build` passing.

## Implementation hint

A simple custom approach is enough:

- each visible tree row already has a `depth`
- render a small `connector-gutter` before the filename
- inside the gutter, render one column per depth level
- use absolutely positioned or flex-based vertical/horizontal lines
- style lines with low-contrast color, for example translucent slate/white

Pseudo-structure:

```tsx
<div className="tree-row">
  <div className="tree-connectors" style={{ width: depth * INDENT }}>
    {/* vertical ancestor lines */}
    {/* current elbow connector */}
  </div>
  <span className="tree-label">{node.name}</span>
</div>
```

Keep it readable and simple. The goal is the nested-comment connector-line feeling, but adapted to a file explorer.

## Success criteria

- The left sidebar no longer looks like folder cards or icon blocks.
- The nesting is readable through connector lines and indentation.
- There are no `v`/square markers before node names.
- The repo scene still plays normally.
- `npm run build` passes.
