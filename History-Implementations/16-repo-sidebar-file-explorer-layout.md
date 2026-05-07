# Prompt 16: Replace the repo sidebar with a real file-explorer tree layout

## Goal

Fix only the **left sidebar** of the repository timelapse scene.

Right now the sidebar does not feel like a file explorer. It uses folder/container cards, duplicate folder names, counters, progress bars, and column-like file groups. Replace that with a simple VS Code/GitHub-Codespaces-style file explorer tree.

Use the provided `codespace-github.mhtml` only as a **visual reference** for the explorer feeling.

## Current problem

The current sidebar has UI patterns that should not exist in a file explorer:

- folder containers with visible borders/backgrounds
- duplicate folder title inside the folder card
- progress bars
- file/folder counters
- subfolder counters
- a `ROOT` container with files arranged in columns
- too much card/dashboard styling

This should become a compact vertical tree list.

## Desired sidebar behavior

Render the repository as a flat vertical tree of rows:

```txt
Explorer
  src
    app
      App.tsx
    scenes
      RepoExplorerScene.tsx
    hooks
  scripts
  package.json
```

Rules:

- one row per visible folder/file node
- indentation shows nesting depth
- compact row height
- no cards
- no bordered folder boxes
- no progress bars
- no file counters
- no duplicate folder labels
- folder/file name is the main content
- use small folder/file icons or simple chevrons if already convenient
- keep it visually close to a code editor file explorer, not a dashboard

## Depth limit

For now, show only nodes up to depth `4`.

Files/folders deeper than that can be hidden for now. Do not build expand/collapse behavior yet unless it is already very easy and does not complicate the code.

## Scope

Change only the repo scene sidebar / explorer area.

Do not change:

- preprocessing scripts
- visual-model generation
- playback logic
- timeline slider
- play/pause/duration controls
- document scene
- center/right repo panels, except if a tiny layout adjustment is needed to fit the new sidebar

## Data logic

Use the existing visual model / current visible repo state.

The sidebar should reflect files/folders that are currently visible at the selected timeline unit.

Important invariant:

- file geometry/size must still come from replayed current line state
- activity mass such as `addedLines + deletedLines` must not control file size
- activity mass can still drive glow/intensity elsewhere, but not this sidebar layout

For this sidebar pass, the visual weight/glow is not important. Focus on the explorer shape.

## Implementation suggestion

Build a derived list of visible tree rows from the currently visible files:

```ts
type ExplorerRow = {
  id: string;
  name: string;
  path: string;
  depth: number;
  kind: "folder" | "file";
};
```

Then render rows vertically with indentation, for example:

```tsx
<div className="repo-explorer-tree">
  {rows.map((row) => (
    <div
      key={row.id}
      className="repo-explorer-row"
      style={{ paddingLeft: `${row.depth * 14}px` }}
    >
      <span>{row.kind === "folder" ? "▸" : ""}</span>
      <span>{row.name}</span>
    </div>
  ))}
</div>
```

This is only a suggestion. Use the project’s current style system/classes.

## Visual reference warning

The `codespace-github.mhtml` file is only a reference.

Do not:

- copy/import its DOM
- depend on it at runtime
- copy VS Code/GitHub class names directly
- recreate the whole VS Code UI

Only imitate the basic left explorer pattern: compact rows, indentation, simple icons, no cards.

## Success criteria

- The left sidebar now looks like a file explorer tree.
- No folder card/container layout remains in the sidebar.
- No progress bars/counters remain in the sidebar.
- Rows are vertical and indented by nesting level.
- Depth is capped at 4.
- Playback and slider behavior still work.
- `npm run build` passes.
