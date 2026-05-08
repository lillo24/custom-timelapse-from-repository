# Prompt 23: Dynamic maxVisibleRows filtering during repo timeline generation

## Goal

Implement the real `maxVisibleRows` behavior for the repository explorer.

The current/desired display model after the previous fix is:

- folders are collapsed by default
- folders listed in `display.maxChildrenByFolder` are open
- no `collapseFolders`
- no `+ N more` / no `moreGroup`
- hidden child activity maps to the nearest visible parent folder
- React renders the display model directly

Now add dynamic row-budget filtering:

```txt
During the timeline replay, if visible rows exceed maxVisibleRows,
hide extra visible child rows from open folders until the row count fits.
```

This should happen in preprocessing / display-model generation, not by inventing new collapse logic in React.

---

## Desired behavior

`display.maxVisibleRows` should mean:

```txt
At every timeline unit, the number of visible explorer rows must be <= maxVisibleRows.
```

A visible row means any row occupying vertical space in the file explorer:

```txt
folder row
collapsed folder row
file row
```

There is no `+ N more` row, so it does not exist and is not counted.

Hidden files/folders still affect their nearest visible parent through glow/activity mapping.

---

## Config

Use the existing config shape:

```json
{
  "display": {
    "maxVisibleRows": 30,
    "maxChildrenByFolder": {
      "assistant_runtime/**": 5,
      "ingestion_pipeline/tools/**": 15,
      "ingestion_pipeline/crawler/**": 5,
      "ingestion_pipeline/crawler/spider/**": 2,
      "ingestion_pipeline/extract/**": 5,
      "ingestion_pipeline/retrieval/**": 5
    },
    "hideButCount": [
      "**/__init__.py"
    ]
  }
}
```

`maxChildrenByFolder` remains the base “opened folder + max children” rule.

`maxVisibleRows` is a dynamic cap applied after base visibility.

---

## Important conceptual model

Base display rules produce the **candidate visible tree**.

Then dynamic row-budget filtering produces the **effective visible tree at each timeline point**.

Example:

```txt
base visible rows at unit 500 = 34
maxVisibleRows = 30
=> hide 4 rows from open folders
=> timeline activity from hidden rows maps to their visible parent folder
```

This means `maxChildrenByFolder` should behave like a base cap, but the dynamic filter can temporarily reduce effective children below that cap.

Conceptually:

```txt
effectiveMaxChildrenByFolder = configured maxChildrenByFolder - dynamic reductions
```

but only when needed at a specific timeline position.

---

## Algorithm

For each relevant timeline position:

1. Compute active/displayable rows at that timeline unit.
2. If row count <= `maxVisibleRows`, keep them all.
3. If row count > `maxVisibleRows`, hide rows one by one until the count fits.

### Which row to hide?

Hide a child row from the open folder that currently has the most visible immediate children.

This matches the intended behavior:

```txt
when N_files > maxVisibleRows:
  find the open folder with the most currently visible children
  hide one child from it
  repeat until visible rows fit
```

If tied, break ties deterministically.

Do not use true random. Use stable pseudo-random / hash ordering so output is reproducible.

Suggested tie-breakers:

```txt
1. highest visible immediate child count
2. folder path hash / seeded deterministic tie-breaker
3. folder path alphabetical fallback
```

### Which child inside that folder should be hidden?

Choose a low-priority child to hide.

Prefer hiding:

```txt
1. file rows before folder rows
2. lower visual weight
3. lower current/final/max line count
4. lower recent/current activity
5. alphabetical / stable hash tie-breaker
```

Do not hide important structural ancestor folders if that would disconnect visible children.

If hiding a folder row, all its visible descendants must also become hidden or remapped consistently.

Keep it simpler if needed: first implementation can hide only file rows from open folders. If that is not enough to reach the budget, then hide the lowest-priority child folders.

---

## Timeline representation

Do not force React to recalculate this algorithm.

Add a generated visibility plan to `repo-display-model.json`.

Possible shape:

```ts
export interface RepoDisplayVisibilityFrame {
  startUnitOrder: number;
  endUnitOrder: number;
  visibleNodeIds: string[];
  hiddenNodeIds: string[];
  effectiveChildLimitsByFolderId: Record<string, number>;
  rowCountBeforeBudget: number;
  rowCountAfterBudget: number;
}
```

A simpler shape is okay if it fits the current code better.

But it must let React answer:

```txt
At selected unit X, which display nodes should be visible?
```

without reimplementing row-budget compression.

Prefer sparse frames/ranges instead of one huge object per unit if practical.

If easier and still performant, one frame per timeline unit is acceptable for now because the dataset is presentation-sized, but avoid unnecessary bloat if the code can stay clean.

---

## Timeline activity remapping

This is critical.

When a timeline unit belongs to a node hidden by the dynamic row-budget filter at that unit:

```txt
map / surface the activity to the nearest visible parent folder at that unit
```

So the row that remains visible glows.

Do not drop activity.

Do not create a `+ N more` row.

If a source row is hidden dynamically:

```txt
hidden child changes
→ nearest visible parent folder glows/heats
```

You can implement this either by:

1. adding `effectiveDisplayNodeId` to timeline units for each visibility frame/unit, or
2. adding a helper structure that React can use directly without recomputing compression.

But React should not decide which rows to hide. It may only look up the generated plan.

---

## React changes

Update `src/scenes/RepoExplorerScene.tsx` only as needed to consume the generated visibility plan.

At selected timeline unit:

```txt
visible rows = generated visibility plan for that unit
recent activity glow = effective mapped display node ids
```

Do not reimplement the budget algorithm in React.

Do not restore scrollbars as the solution.

The explorer should fit because the data says which rows are visible.

Keep:

- current file explorer layout
- connector lines
- floating playback controls
- hidden-count badges on folder rows
- document scene untouched

Remove any old assumption that “all display nodes active by current unit are visible.”

---

## Counting rules

`maxVisibleRows` counts only rows actually rendered in the explorer.

Count these:

```txt
folder
collapsedFolder
file
```

Do not count hidden nodes.

Do not count removed `moreGroup`.

Do not count cluster cards or playback controls.

---

## Hidden count metadata

Keep the existing hidden count shown near folder names.

When dynamic filtering hides additional nodes, update or extend hidden metadata so the UI can still show that the parent contains hidden content.

Example:

```txt
retrieval   8 hidden
```

Names can follow existing fields:

```txt
hiddenChildCount
hiddenDescendantCount
dynamicHiddenChildCount
```

Use whatever is cleanest, but preserve the idea.

---

## Critical invariant

Never use total activity mass as geometry.

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

## Reports / debugging

Add generated metadata and console summary:

```txt
maxVisibleRows
peakRowsBeforeBudget
peakRowsAfterBudget
framesWithBudgetApplied
totalDynamicHiddenEvents
foldersReducedByBudget
timelineUnitsRemappedBecauseHidden
```

Also output a few examples:

```txt
Budget applied at unit 1234: 36 -> 30 rows
Reduced ingestion_pipeline/retrieval from 5 to 3 visible children
Reduced assistant_runtime from 5 to 4 visible children
```

Warnings:

```txt
budget could not be reached
timeline unit could not be mapped to visible parent
visibility frame has more rows than maxVisibleRows
visibility frame references unknown node id
```

---

## Constraints

- Work primarily in `scripts/generate-display-model.ts`, display-model types, and minimal React consumption.
- Do not change raw Git extraction.
- Do not change file-state reconstruction.
- Do not change change-unit generation.
- Do not change visual-model generation unless absolutely necessary.
- Do not reintroduce `collapseFolders`.
- Do not reintroduce `moreGroup` / `+ N more`.
- Do not solve overflow with scrollbars.
- Keep output deterministic.
- `npm run build` must pass.

---

## Validation

Run:

```bash
npm run build:animation-data -- --repo ../thesis-disi-chatbot --config repo-animation.config.json
npm run build
```

Then verify:

```txt
peak visible explorer rows <= maxVisibleRows
no + N more rows exist
folders in maxChildrenByFolder open initially up to their base cap
dynamic filtering reduces visible children only when the row budget is exceeded
hidden dynamic activity glows the nearest visible parent folder
all timeline units still map to visible/effective display nodes
```

---

## Success criteria

- `maxVisibleRows` is enforced during the generated timeline, not as a static final-tree auto-collapse.
- React consumes the generated visibility plan instead of deciding compression itself.
- `extract` and `retrieval` do not collapse just because static final rows are too high.
- When the visible row count exceeds the budget, the generator hides rows from the open folder with the most visible children.
- Hidden row activity flows to visible parent folder glow.
- No `+ N more` row returns.
