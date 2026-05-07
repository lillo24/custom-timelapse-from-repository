# Prompt 19: Generate a repo display model for simplified explorer rendering

## Goal

Add a new preprocessing step that converts the current visual model into a simplified **display model** for the repository explorer UI.

Right now the explorer can overflow vertically because it shows too many visible file/folder rows.  
Do **not** solve this directly in React first. Create a data-level display model that React can render later.

## Current pipeline

The repo already has:

```txt
raw Git history
→ file states
→ change units
→ filtered dataset
→ visual model
→ React UI
```

Add:

```txt
visual model
→ display model
→ React UI later
```

The new output should be:

```txt
data/generated/repo-display-model.json
public/data/repo-display-model.json
```

Do not switch the React UI to this model yet unless it is trivial and safe. The main goal of this prompt is preprocessing.

## Core concept

There are three different operations:

### 1. Exclude

Already handled by the existing filtering pipeline.

Examples:

```txt
node_modules
dist
build
History_Implementation_plans
.agents
generated/cache files
```

Do not duplicate exclusion logic here.

### 2. Hide but count

A file is not shown as a visible row, but its activity still contributes to the nearest visible parent.

Good candidates:

```txt
**/__init__.py
**/__pycache__/**
**/*.pyc
```

For now, start with `**/__init__.py`.

### 3. Collapse folder

A folder is shown as one visible row, while children inside it are hidden.

Important: child file activity must still map to the collapsed folder row, so that later the row can glow/heat when internal files change.

Example:

```txt
tools/ingestion_debug_ui_react_3/**
```

Visible as one row:

```txt
ingestion_debug_ui_react_3
```

But internally it represents all descendant files.

## Config

Extend `repo-animation.config.json` with a new `display` section.

Example:

```json
{
  "display": {
    "maxDepth": 4,
    "hideButCount": [
      "**/__init__.py"
    ],
    "collapseFolders": [
      "tools/ingestion_debug_ui_react_3/**"
    ],
    "maxChildrenByFolder": {
      "ingestion_pipeline/**": 20,
      "tools/**": 15,
      "tests/**": 12
    }
  }
}
```

Keep defaults if the config section is missing:

```txt
maxDepth = 4
hideButCount = []
collapseFolders = []
maxChildrenByFolder = {}
```

If the existing glob matcher is too limited, minimally extend it or document the supported pattern subset. Do not overbuild.

## Display model shape

Create shared TypeScript types, for example:

```ts
export type RepoDisplayNodeType = "folder" | "file" | "collapsedFolder" | "moreGroup";

export interface RepoDisplayNode {
  id: string;
  label: string;
  path: string;
  type: RepoDisplayNodeType;
  depth: number;

  sourceFileIds: string[];
  sourceFolderIds: string[];

  finalLineCount: number;
  maxLineCount: number;
  visualWeight: number;

  childCount: number;
  hiddenChildCount: number;
}
```

The exact shape can differ if the existing visual-model types suggest a better naming, but preserve the idea:

```txt
visible node
→ references source files/folders
→ can receive glow/heat from hidden descendants later
```

## Timeline mapping

The display model should preserve a timeline layer where each original timeline unit maps to one visible display node.

Example:

```ts
{
  unitOrder: 123,
  sourceFileId: "...",
  displayNodeId: "collapsed:tools/ingestion_debug_ui_react_3",
  type: "grow",
  activityWeight: 0.42,
  beforeLineCount: 100,
  afterLineCount: 125
}
```

Rules:

- If the changed file is visible, map the unit to that file node.
- If the file is hidden by `hideButCount`, map it to the nearest visible parent folder/collapsed folder.
- If the file is inside a collapsed folder, map it to the collapsed folder node.
- If the file is deeper than `maxDepth`, map it to the nearest visible ancestor or a `moreGroup` node.

## Max children behavior

For folders with `maxChildrenByFolder`, show only up to N children.

The hidden extra children should be represented by one synthetic row:

```txt
+ 17 more
```

Type:

```txt
moreGroup
```

The `moreGroup` row should also receive timeline activity from hidden children later.

Selection of the visible N children should be deterministic. Prefer more visually meaningful children:

1. folders before files
2. higher final/max line count
3. higher activity weight
4. alphabetical tie-breaker

## Critical invariant

Do not compute visible file/folder size from total activity mass.

Wrong:

```txt
visual size = addedLines + deletedLines
```

Correct:

```txt
visual size = actual line state / persistent line counts
```

Activity mass can be used later for glow/heat/timing only.

Example:

```txt
+100 / -90
```

should not become a file that looks 190 lines bigger. Its final size changed by about +10.

## Script

Add a script like:

```txt
scripts/generate-display-model.ts
```

Add npm command:

```json
"generate:display-model": "tsx scripts/generate-display-model.ts"
```

Inputs:

```txt
--model data/generated/repo-visual-model.json
--config repo-animation.config.json
--out data/generated/repo-display-model.json
```

Also update the pipeline runner so `npm run build:animation-data` generates the display model after the visual model.

Mirror the output to:

```txt
public/data/repo-display-model.json
```

same as the visual model bridge.

## Report / validation

Update or add a small summary in console output:

```txt
Display model generated
Visible nodes: X
Hidden-but-counted files: Y
Collapsed folders: Z
More groups: W
Timeline units mapped: N
```

Warnings should include:

- timeline unit could not be mapped to a display node
- collapse rule matches nothing
- maxChildren rule matches nothing
- node deeper than maxDepth has no visible ancestor

## Constraints

- No React UI redesign in this prompt.
- Do not remove the existing visual model.
- Do not change raw extraction.
- Do not change file-state reconstruction.
- Do not change change-unit generation.
- Do not touch the document/Word scene.
- Keep outputs deterministic.
- `npm run build` must pass.

## Success criteria

- `npm run generate:display-model -- --model data/generated/repo-visual-model.json --config repo-animation.config.json --out data/generated/repo-display-model.json` works.
- `npm run build:animation-data -- --repo ../thesis-disi-chatbot --config repo-animation.config.json` also generates `repo-display-model.json`.
- The display model has fewer visible nodes than the visual model.
- Hidden/collapsed files still map their timeline activity to visible display nodes.
- The output is ready for React to render without needing React to decide collapse/hide logic.
