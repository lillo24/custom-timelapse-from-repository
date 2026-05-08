# Prompt 25: Configurable size-tracked folders/files for Repo Explorer V2

## Goal

Start Repo Explorer V2 by making selected folders/files visually grow based on their **actual current line count** during the replay.

This must be configurable.

Do **not** make all folders/files grow.  
Only nodes explicitly configured as size-tracked should change visual size.

## Current state

The repo already has:

```txt
Git history
→ file states
→ change units
→ filtered dataset
→ visual model
→ display model
→ React repo explorer
```

The display model already gives visible nodes with:

```txt
sourceFileIds[]
finalLineCount
maxLineCount
visualWeight
```

React already replays current line state from file timeline units.

Use this existing data. Do not rebuild line counting from scratch.

## Desired concept

Some configured visible nodes should get visually bigger as their contained code grows.

For files:

```txt
current size = current line count of that file
```

For folders:

```txt
current size = sum of current line counts of all source files inside that folder node
```

This includes hidden/collapsed children through `sourceFileIds`.

Example:

```txt
ingestion_pipeline/retrieval
→ size based on all files inside retrieval
```

## Config

Extend `repo-animation.config.json` with something like:

```json
{
  "display": {
    "sizeTrackedNodes": {
      "ingestion_pipeline": { "maxScale": 1.6 },
      "ingestion_pipeline/extract": { "maxScale": 1.7 },
      "ingestion_pipeline/retrieval": { "maxScale": 1.7 },
      "assistant_runtime": { "maxScale": 1.5 },
      "tools/ingestion_debug_ui_react_3": { "maxScale": 1.4 }
    },
    "sizeNormalization": "trackedMax"
  }
}
```

If exact object shape differs, keep the same meaning.

Defaults:

```txt
sizeTrackedNodes = {}
sizeNormalization = "trackedMax"
```

If no nodes are configured, the explorer should behave like V1/current live behavior.

## Matching rules

Configured keys should match display node paths.

Example:

```txt
"ingestion_pipeline/retrieval"
```

matches the visible display node with path:

```txt
ingestion_pipeline/retrieval
```

Do not require `/**` for this feature unless the existing matcher makes that much cleaner.

Warn if a configured size-tracked path matches no display node.

## Normalization

Use this normalization:

```txt
normalizationMaxLines = max(maxLineCount of all configured size-tracked nodes)
```

So the largest configured tracked node becomes the reference.

Do **not** normalize folders against the biggest single file unless that is also the biggest tracked node.

For each tracked node:

```txt
sizeRatio = currentLineCount / normalizationMaxLines
```

Clamp safely:

```txt
sizeRatio = clamp(sizeRatio, 0, 1)
```

Then map it to a visual scale.

Example:

```txt
scale = 1 + sizeRatio * (maxScale - 1)
```

Where `maxScale` comes from the config entry.

## Preprocessing changes

Update the display model generator/types so each display node can include metadata like:

```ts
sizeTracking?: {
  enabled: boolean;
  maxScale: number;
  normalizationMaxLines: number;
}
```

Names can differ if cleaner.

The key is:

```txt
React should not decide which nodes are tracked.
React should only render based on metadata from the display model.
```

Also include summary metadata:

```txt
sizeTrackedNodeCount
sizeTrackingNormalizationMaxLines
sizeTrackedWarnings
```

## React changes

Update `src/scenes/RepoExplorerScene.tsx` to render tracked nodes with subtle visual growth.

Important: this is still a file-explorer layout, not cards.

Suggested effects for size-tracked nodes:

```txt
row height grows slightly
font size grows slightly
font weight increases slightly
connector/row glow may become stronger
```

Use conservative ranges.

Example:

```txt
row height: 18px → max 34px
font size: 11px → max 14px
```

Do **not** make tracked folders huge enough to break the explorer layout.

Do **not** use width-heavy cards.

Do **not** restore old folder containers.

## Current line count source

For a tracked visible node:

```txt
currentLineCount = sum current lines of node.sourceFileIds at selected timeline unit
```

This should follow the existing replay logic.

If the node is a folder, this should naturally make it grow as files inside are created/edited.

If the node is a file, it should grow based on that file only.

## Critical invariant

Never use total activity mass as geometry.

Wrong:

```txt
visual size = addedLines + deletedLines
```

Correct:

```txt
visual size = actual replayed current line state / persistent line counts
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

must not make the file look 190 lines bigger. Its net file-state change is about +10.

## V1 snapshot safety

Do not modify the V1 snapshot data or V1 scene behavior.

The V1 scene should keep reading:

```txt
/data/snapshots/repo-display-model-v1.json
```

V2/live scene can use the updated live display model:

```txt
/data/repo-display-model.json
```

If the V1 scene shares the same React component, ensure size-tracking only activates when the loaded model has size-tracking metadata.

## Constraints

- Do not change raw Git extraction.
- Do not change file-state reconstruction.
- Do not change change-unit generation.
- Do not change visual model unless absolutely necessary.
- Do not reintroduce `+ N more`.
- Do not reintroduce `collapseFolders`.
- Do not break connector lines.
- Do not solve layout by scrollbars.
- Keep output deterministic.
- Keep `npm run build` passing.

## Validation

Run:

```bash
npm run build:animation-data -- --repo ../thesis-disi-chatbot --config repo-animation.config.json
npm run build
```

Browser check:

```txt
Repository V1 still looks like frozen V1.
Live Repository scene shows configured folders/files subtly growing.
Unconfigured nodes keep normal row sizing.
Folder size is based on summed current lines of sourceFileIds.
No node geometry uses addedLines + deletedLines activity mass.
No overflow/scrollbar regression.
```

## Success criteria

- Config can choose which folders/files are size-tracked.
- Size-tracked folders grow based on summed current lines of contained files.
- Normalization uses the largest configured tracked node.
- Each tracked node respects its configured maxScale.
- React reads size-tracking metadata from the display model.
- V1 snapshot remains safe.
- `npm run build` passes.
