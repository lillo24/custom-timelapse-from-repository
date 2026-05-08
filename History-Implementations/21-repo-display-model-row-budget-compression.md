# Prompt: Add row-budget compression to the repo display model

## Goal

Improve the repository explorer height problem by adding automatic row-budget compression to the **display model generator**.

The React explorer should not decide what to hide/collapse.  
The preprocessing display model should output a bounded, presentation-friendly list of visible rows.

## Current situation

The pipeline already has:

```txt
repo-visual-model.json
→ repo-display-model.json
→ React renders display nodes
```

`repo-display-model.json` already supports:

- `maxDepth`
- `hideButCount`
- `collapseFolders`
- `maxChildrenByFolder`
- `collapsedFolder`
- `moreGroup`
- timeline units mapped to visible display nodes

Now add a global visible row budget.

## Config

Extend the `display` section in `repo-animation.config.json`:

```json
{
  "display": {
    "maxDepth": 4,
    "maxVisibleRows": 70,
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

Defaults if missing:

```txt
maxVisibleRows = null
```

If `maxVisibleRows` is missing/null, keep current behavior.

## Behavior

After applying the existing display rules, count the visible explorer rows.

If:

```txt
visibleRows <= maxVisibleRows
```

do nothing.

If:

```txt
visibleRows > maxVisibleRows
```

automatically collapse/hide additional nodes until the visible row count is at or below the budget.

## Compression strategy

Do this deterministically.

The goal is not perfect truth. The goal is a clean presentation explorer that fits vertically.

Prefer to reduce clutter in this order:

### 1. Hide boring leaf files, but still count their activity

Examples:

```txt
__init__.py
index.ts
index.tsx
small glue files
```

They should disappear as individual rows, but their timeline activity must map to the nearest visible parent or `moreGroup`.

### 2. Collapse deeper folders first

Prefer collapsing folders with higher depth before top-level folders.

Good:

```txt
ingestion_pipeline/retrieval/some/deep/folder
```

Bad as first choice:

```txt
ingestion_pipeline
assistant_runtime
tools
tests
```

### 3. Prefer collapses that save many rows

A folder with many descendants is a good collapse candidate.

### 4. Preserve important top-level story folders

Avoid collapsing these too early:

```txt
ingestion_pipeline
assistant_runtime
tools
tests
src
```

They are important for understanding the project arc.

If needed, collapse inside them, not the top-level folder itself.

### 5. Tie-break deterministically

Use stable tie-breakers:

```txt
rowsSaved desc
depth desc
visualWeight asc or activityWeight asc
path alphabetical
```

Do not use random selection.

## Node types

Use existing node types where possible:

```txt
folder
file
collapsedFolder
moreGroup
```

If a folder is auto-collapsed, represent it as:

```txt
type: "collapsedFolder"
```

If only part of a folder is hidden because of a row budget, use or reuse:

```txt
type: "moreGroup"
label: "+ N more"
```

## Timeline mapping requirement

This is the most important part.

Every timeline unit must still map to a visible display node.

Rules:

- If the changed file is still visible, map to that file node.
- If the changed file is hidden by row-budget cleanup, map to the nearest visible parent.
- If the changed file is inside an auto-collapsed folder, map to that collapsed folder node.
- If it belongs to a `moreGroup`, map to the `moreGroup` node.
- Do not leave units unmapped.

The React UI should still receive normal visible-node activity through `displayNodeId`.

## Critical invariant

Never use total activity mass as visual geometry.

Wrong:

```txt
visual size = addedLines + deletedLines
```

Correct:

```txt
visual size = actual line state / persistent line counts
```

Activity mass may drive glow, heat, pulse, or timing only.

Example:

```txt
+100 / -90
```

should not make the visible node look 190 lines bigger. Its net file-state change is about +10.

## Summary / warnings

Update console output and/or generated metadata to include:

```txt
maxVisibleRows
visibleRowsBeforeBudget
visibleRowsAfterBudget
autoHiddenFiles
autoCollapsedFolders
autoMoreGroups
timelineUnitsMapped
```

Warnings should include:

- budget cannot be reached
- timeline unit cannot be mapped
- auto-collapse candidate has no visible parent
- config rule matches nothing

## Constraints

- Work mainly in `scripts/generate-display-model.ts` and display-model types/config.
- Do not change raw Git extraction.
- Do not change file-state reconstruction.
- Do not change change-unit generation.
- Do not change visual-model generation unless absolutely necessary.
- Do not redesign the React explorer in this prompt.
- React should keep consuming `repo-display-model.json`.
- Keep outputs deterministic.
- Keep the existing manual `collapseFolders`, `hideButCount`, and `maxChildrenByFolder` behavior.
- `npm run build` must pass.

## Validation

Run:

```bash
npm run build:animation-data -- --repo ../thesis-disi-chatbot --config repo-animation.config.json
npm run build
```

Then check:

```txt
repo-display-model.json visible node count <= maxVisibleRows
all timeline units still mapped
collapsed/hidden child activity still flows to visible rows
```

## Success criteria

- The display model can enforce a global row budget.
- The repository explorer can fit vertically without React-side collapse decisions.
- Important top-level project folders are still visible when possible.
- Hidden/collapsed files still produce glow/heat through visible rows.
- Geometry still comes from current line state, not activity mass.
