# Prompt: Fix display-model collapse semantics and remove `+ N more`

## Goal

Fix the repository display model + React explorer behavior.

The current row-budget/static compression behavior is wrong.  
This prompt should implement only the first two fixes:

1. Folders collapse by default. Only folders configured in `maxChildrenByFolder` are open.
2. Remove `+ N more` rows completely. Hidden child activity should glow the parent folder instead.

Do **not** implement the later dynamic `maxVisibleRows` algorithm yet.

---

## Current problem

Right now the display model can auto-collapse folders like:

```txt
ingestion_pipeline/extract
ingestion_pipeline/retrieval
```

even though they were not explicitly listed in `collapseFolders`.

This happened because the display-model generator added static row-budget compression / auto-collapse logic after building the tree.

That behavior is not wanted anymore.

---

## New intended model

### Folder visibility rule

All folders are collapsed by default.

A folder is open only if it is configured in:

```json
"display": {
  "maxChildrenByFolder": {
    "assistant_runtime/**": 5,
    "ingestion_pipeline/tools/**": 15,
    "ingestion_pipeline/crawler/**": 5,
    "ingestion_pipeline/crawler/spider/**": 2,
    "ingestion_pipeline/extract/**": 5,
    "ingestion_pipeline/retrieval/**": 5
  }
}
```

Meaning:

```txt
folder configured in maxChildrenByFolder = open, show up to N immediate children
folder not configured = collapsed, show only the folder row
```

Ancestors of opened folders must still be visible so the tree path makes sense.

Example:

If this is configured:

```txt
ingestion_pipeline/retrieval/**: 5
```

then these rows can appear:

```txt
ingestion_pipeline
  retrieval
    search_bm25.py
    index_bm25.py
```

Even if `ingestion_pipeline/**` itself is not configured, it must be visible as the ancestor.

But unconfigured sibling folders should remain collapsed.

---

## Remove `collapseFolders`

`collapseFolders` should no longer drive display behavior.

Options:

- remove it from `repo-animation.config.json`, or
- keep accepting it for now but ignore it with a clear comment/warning.

Preferred: remove it from the config and update types/docs.

From now on:

```txt
maxChildrenByFolder = controls which folders open + how many immediate children they show
hideButCount = hides specific boring files while preserving their activity
maxVisibleRows = reserved for later dynamic filtering, not static auto-collapse
```

---

## Remove `+ N more`

Remove the `moreGroup` row concept from the display model and React UI.

There should be no visible row like:

```txt
+ 21 more
```

Reason: it occupies vertical space and complicates row counting.

Hidden children should instead be represented by the existing hidden-count metadata shown near the parent folder name in the UI.

That hidden count should stay.

---

## Timeline / glow mapping

This is important.

If a file is hidden because:

- its parent folder is collapsed by default,
- it exceeds the `maxChildrenByFolder` limit,
- it matches `hideButCount`,
- it is deeper than `maxDepth`,

then its timeline units must map to the nearest visible parent folder node.

So:

```txt
hidden child changes
→ parent folder row glows/heats
```

No activity should map to a deleted `moreGroup`.

Every timeline unit must still map to exactly one visible display node.

If the direct parent is not visible, walk upward until a visible ancestor is found.

---

## `maxChildrenByFolder` behavior

For each open folder:

```txt
show at most N immediate children
```

If there are more than N children:

```txt
hide the extra children
map their activity to the open parent folder
increase the parent folder hiddenChildCount / hiddenDescendantCount metadata
```

Do **not** create `+ N more`.

Child selection should be deterministic.

Prefer visible children by:

1. folders before files
2. higher final/max line count
3. higher activity weight
4. alphabetical path tie-breaker

---

## `maxVisibleRows` behavior for now

Do **not** implement the dynamic row-budget algorithm yet.

Remove or disable the current static row-budget compression that auto-collapses folders.

For now, `maxVisibleRows` should be one of these:

- ignored with a console/report note, or
- used only as a warning/report field:
  ```txt
  visibleRowsAfterDisplayRules > maxVisibleRows
  ```

But it must **not** change the display tree in this prompt.

Later we will implement dynamic filtering during generation/replay.

---

## Display model type changes

Update shared types accordingly.

Remove or stop emitting:

```txt
type: "moreGroup"
```

Valid node types should become something like:

```ts
export type RepoDisplayNodeType = "folder" | "file" | "collapsedFolder";
```

If keeping `collapsedFolder` is useful, use it for folder rows that are visible but closed.  
Otherwise `folder` can have metadata like:

```ts
isOpen: boolean;
isCollapsed: boolean;
```

Use the cleanest option for the existing code.

Each folder node should carry enough metadata for the UI:

```ts
childCount
visibleChildCount
hiddenChildCount
hiddenDescendantCount
```

Names can differ if existing types already use better names.

---

## React UI changes

Update `src/scenes/RepoExplorerScene.tsx` to match the new display model.

Requirements:

- render display nodes directly as before
- do not render `moreGroup`
- remove any special UI logic for `+ N more`
- preserve the hidden count shown near folder names
- hidden file activity should make the parent folder row glow because timeline units now map there
- keep connector lines
- keep floating playback controls
- keep current line-count sizing invariant

Do not redesign the explorer style.

---

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

Activity mass can drive:

```txt
glow
heat
pulse
timing intensity
```

but not row/file geometry.

Example:

```txt
+100 / -90
```

should not make the visible node look 190 lines bigger. Its net file-state change is about +10.

---

## Validation

Run:

```bash
npm run build:animation-data -- --repo ../thesis-disi-chatbot --config repo-animation.config.json
npm run build
```

Then check generated output:

- no `moreGroup` nodes exist
- no `+ N more` row appears in UI
- folders not in `maxChildrenByFolder` are collapsed by default
- folders in `maxChildrenByFolder` are open and capped by their configured number
- `ingestion_pipeline/extract` and `ingestion_pipeline/retrieval` open if configured
- hidden child activity maps to visible parent folder nodes
- all timeline units are mapped to visible display nodes
- no static `maxVisibleRows` auto-collapse changes the tree

---

## Success criteria

- Display model no longer uses `collapseFolders`.
- Display model no longer emits `moreGroup`.
- React no longer shows `+ N more`.
- Hidden files still affect glow through their parent folders.
- `maxChildrenByFolder` is now the main folder-open control.
- `maxVisibleRows` does not auto-collapse anything yet.
- `npm run build` passes.
