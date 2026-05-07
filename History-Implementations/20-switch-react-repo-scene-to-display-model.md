# Prompt 20: Switch the React repo scene to the display model

## Goal

Switch the repository explorer React scene from `repo-visual-model.json` to the new simplified `repo-display-model.json`.

I do **not** need backwards compatibility with the old visual-model rendering unless keeping a tiny adapter clearly improves code quality.

The display model is now the source of truth for the repo explorer UI.

## Current situation

The preprocessing pipeline now produces:

```txt
data/generated/repo-display-model.json
public/data/repo-display-model.json
```

The display model already encodes:

- visible nodes
- hidden-but-counted files
- collapsed folders
- max-depth simplification
- max-children / `moreGroup` nodes
- timeline units mapped to visible display nodes

So React must **not** reimplement collapse/hide/max-depth logic.

## Main change

Old mental model:

```txt
React loads repo-visual-model.json
React renders files/folders from the visual model
React replays timeline by source file ids
```

New mental model:

```txt
React loads repo-display-model.json
React renders display nodes directly
React replays timeline by displayNodeId
```

## What to implement

### 1. Replace the loader source

Update the repo scene loader/hook.

Old:

```txt
/public/data/repo-visual-model.json
```

New:

```txt
/public/data/repo-display-model.json
```

Rename the hook/types if useful, for example:

```txt
useRepoDisplayModel
```

Prefer clean naming over backwards compatibility.

### 2. Render display nodes directly

The file explorer sidebar should render the display model's visible nodes.

Each node is already one visible row:

```txt
folder
file
collapsedFolder
moreGroup
```

Do not rebuild the tree from raw files in React.

Do not apply new max-depth logic in React.

Do not apply new collapse logic in React.

Do not apply new hide/filter logic in React.

Use the node's existing fields:

```txt
id
label
path
type
depth
sourceFileIds
sourceFolderIds
childCount
hiddenChildCount
finalLineCount
maxLineCount
visualWeight
```

Field names may differ slightly depending on the actual implemented type. Follow the real generated JSON/types.

### 3. Replay timeline through displayNodeId

Old logic probably does something like:

```txt
timeline unit -> file id -> visible file row
```

Replace with:

```txt
timeline unit -> displayNodeId -> visible display row
```

Rules:

- If a timeline unit maps to a file node, glow that file row.
- If it maps to a collapsed folder, glow that collapsed folder row.
- If it maps to a `moreGroup`, glow the `+ N more` row.
- If it maps to a folder node, glow that folder row.

### 4. Preserve current-line-count sizing

Keep the current invariant:

```txt
visual size = current line state / persistent line counts
```

Never use activity mass as geometry.

Wrong:

```txt
visual size = addedLines + deletedLines
```

Correct:

```txt
visual size = replayed currentLineCount bounded by finalLineCount / maxLineCount / visualWeight
```

Activity mass can still drive:

```txt
glow
heat
pulse
timing intensity
```

but not width/height.

### 5. Collapsed and hidden content behavior

Collapsed folders and `moreGroup` rows are normal visible nodes.

They should receive timeline activity from hidden descendants because the preprocessing already maps units to their `displayNodeId`.

React should simply trust this mapping.

### 6. Keep the existing UI style

Do not redesign the scene.

Keep:

- the nice file-explorer sidebar layout
- connector lines
- floating playback controls
- Play / Reset / progress / duration / multiplier controls
- current animation behavior
- document scene untouched

Only adapt the data source and replay mapping.

## Cleanup expectations

Because backwards compatibility is not required, remove old visual-model-specific UI code if it becomes dead.

Good cleanup:

- old unused `useRepoVisualModel` hook if no longer used
- visual-model-only helper functions in the React scene
- visual-model-only types imported by UI

Bad cleanup:

- deleting preprocessing visual-model generation
- deleting `repo-visual-model.json` pipeline output
- changing raw preprocessing logic

The visual model should still exist as an upstream preprocessing artifact. The React scene should just consume the display model.

## Validation

Run:

```txt
npm run build:animation-data -- --repo ../thesis-disi-chatbot --config repo-animation.config.json
npm run build
```

Also manually check in browser if possible:

- no sidebar vertical overflow explosion
- collapsed folder rows glow when internal files change
- `+ N more` row glows when hidden children change
- connector lines still look good
- controls still work
- document scene still works

## Success criteria

- Repo scene loads `public/data/repo-display-model.json`.
- Repo explorer renders fewer rows than before.
- React does not duplicate display simplification logic.
- Timeline replay uses `displayNodeId`.
- Hidden/collapsed descendant activity still appears on visible rows.
- File/folder geometry is still based on current line state, not activity mass.
- `npm run build` passes.
