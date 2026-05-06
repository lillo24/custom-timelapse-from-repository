# 09 — Visual Model Generator (pre-UI)

## Goal

Add a preprocessing step that converts the cleaned animation dataset into a UI-ready visual model for the future repository timelapse.

This is still **not UI work**. Do not create React components for the repo explorer yet.

The output should be a stable JSON file that the future UI can consume directly.

## Context

The pipeline currently produces:

- `data/generated/raw-git-history.json`
- `data/generated/repo-file-states.json`
- `data/generated/repo-change-units.json`
- `data/generated/repo-animation-dataset.json`
- `data/generated/repo-animation-summary.json`

The cleaned dataset already excludes unwanted material such as:

- `History_Implementation_plans/**`
- `tools/ingestion_debug_ui_react_3/.agents/**`

Now create a visual-model layer on top of `repo-animation-dataset.json`.

## New output

Create:

```txt
/data/generated/repo-visual-model.json
```

Add a script, for example:

```txt
scripts/generate-visual-model.ts
```

Add an npm script, for example:

```txt
npm run generate:visual-model
```

Also wire it into the full pipeline runner after filtering/summarizing if that fits cleanly.

## Visual model contents

The JSON should include:

```ts
type RepoVisualModel = {
  generatedAt: string;
  sourceDatasetPath: string;
  files: VisualFile[];
  folders: VisualFolder[];
  timeline: VisualTimelineUnit[];
  summary: {
    fileCount: number;
    folderCount: number;
    unitCount: number;
    maxFileLines: number;
    totalFinalLines: number;
  };
  warnings: string[];
};
```

### Files

Each included file should become a visual file entry:

```ts
type VisualFile = {
  id: string;
  path: string;
  name: string;
  folderPath: string;
  extension: string | null;
  category: string;
  language: string | null;
  finalLineCount: number;
  maxLineCount: number;
  visualSize: "xs" | "sm" | "md" | "lg" | "xl";
  visualWeight: number; // normalized 0..1
  firstUnitOrder: number | null;
  lastUnitOrder: number | null;
};
```

Use line counts for sizing, not bytes.

Clamp aggressively so one large file does not dominate the whole future UI.

Suggested logic:

- normalize by `maxLineCount`
- use a square-root/log-style scale
- map to size buckets `xs/sm/md/lg/xl`

### Folders

Build a simple folder list from included file paths:

```ts
type VisualFolder = {
  id: string;
  path: string;
  name: string;
  depth: number;
  parentPath: string | null;
  fileCount: number;
  totalFinalLines: number;
  categories: string[];
};
```

Do **not** implement animated folder growth yet.

Folders are only structural metadata for the later UI.

### Timeline

Convert included change units into timeline entries:

```ts
type VisualTimelineUnit = {
  unitOrder: number;
  fileId: string;
  filePath: string;
  folderPath: string;
  type: string;
  lineDelta: number;
  activityWeight: number;
  beforeLineCount: number | null;
  afterLineCount: number | null;
};
```

Important: separate activity from final visual size.

- `activityWeight` = how much this unit contributes to the animation pacing.
- `visualSize` on the file = how large the file should look in the future UI.

Do **not** make `addedLines + deletedLines` directly inflate final file size.

A refactor like `+100 / -90` should be high activity, but only small final growth if the state says the file ended near the same size.

## Constraints

- No React UI.
- No repo explorer component.
- No animation code.
- No Remotion.
- No changes to the existing Google Doc / Word mock scene.
- No new filtering rules unless needed for correctness.
- Do not reintroduce excluded `.agents` or `History_Implementation_plans` material.
- Keep output deterministic.
- Keep TypeScript strict/build clean.

## CLI behavior

Support at least:

```txt
npm run generate:visual-model -- --dataset data/generated/repo-animation-dataset.json --out data/generated/repo-visual-model.json
```

If wired into the full runner, this should also work:

```txt
npm run build:animation-data -- --repo ../thesis-disi-chatbot --config repo-animation.config.json
```

and produce/update `repo-visual-model.json`.

## Validation

Run:

```txt
npm run generate:visual-model -- --dataset data/generated/repo-animation-dataset.json --out data/generated/repo-visual-model.json
npm run build
```

If the pipeline runner was updated, also run:

```txt
npm run build:animation-data -- --repo ../thesis-disi-chatbot --config repo-animation.config.json
```

## Success criteria

- `repo-visual-model.json` is generated.
- It contains files, folders, timeline, summary, and warnings.
- File visual sizes are clamped and based on line counts.
- Timeline units preserve original order.
- Activity weight and file visual size are separate concepts.
- No UI was added.
- `npm run build` passes.
