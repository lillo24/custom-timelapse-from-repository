# 05 — Validation and Summary for Repository Animation Data

## Goal

Add a final preprocessing validation step that checks whether the generated repository animation dataset looks sane before any UI work starts.

This step should not create UI, animation, React components, or visual layout code.

## Current pipeline

The repo already has these steps:

1. `npm run extract:git`
   - outputs `data/generated/raw-git-history.json`
2. `npm run reconstruct:states`
   - outputs `data/generated/repo-file-states.json`
3. `npm run generate:units`
   - outputs `data/generated/repo-change-units.json`
4. `npm run filter:animation-data`
   - outputs `data/generated/repo-animation-dataset.json`

Now add a fifth step:

```bash
npm run summarize:animation-data -- --dataset data/generated/repo-animation-dataset.json --out data/generated/repo-animation-summary.json
```

## What to implement

Create a script, for example:

```txt
scripts/summarize-animation-data.ts
```

Add shared types if useful, for example:

```txt
src/preprocessing/animationSummaryTypes.ts
```

Add a package script:

```json
"summarize:animation-data": "tsx scripts/summarize-animation-data.ts"
```

## Summary output

Write:

```txt
data/generated/repo-animation-summary.json
```

The summary should include at least:

```ts
type RepoAnimationSummary = {
  generatedAt: string;
  inputDatasetPath: string;
  totals: {
    includedFiles: number;
    excludedFiles: number;
    includedUnits: number;
    excludedUnits: number;
    totalFinalLines: number;
    totalMaxLines: number;
  };
  byCategory: Array<{
    category: string;
    fileCount: number;
    unitCount: number;
    finalLines: number;
  }>;
  byLanguage: Array<{
    language: string;
    fileCount: number;
    unitCount: number;
    finalLines: number;
  }>;
  topFoldersByLines: Array<{
    folder: string;
    fileCount: number;
    finalLines: number;
  }>;
  largestFiles: Array<{
    path: string;
    category: string;
    language: string;
    finalLineCount: number;
    maxLineCount: number;
  }>;
  mostChangedFiles: Array<{
    path: string;
    unitCount: number;
    category: string;
    language: string;
  }>;
  warnings: string[];
};
```

Keep arrays capped to a reasonable number, for example top 10 or top 20.

## Validation checks

Add warnings for suspicious data, for example:

- dataset has zero included files
- dataset has zero included units
- a file has negative line counts
- a file has `finalLineCount > maxLineCount`
- an included unit references a file that is not in included files
- unusually huge file after filtering, for example more than 3000 lines
- too many excluded units compared to included units
- unknown category/language values if your classifier uses fixed labels

Do not fail the script for normal warnings. Only hard-fail on invalid input JSON, missing file, or impossible schema shape.

## Console output

Print a compact human-readable summary, for example:

```txt
Repository animation summary
Included files: 43
Included units: 611
Final lines: 8,292
Top category: source-code
Warnings: 0
Wrote data/generated/repo-animation-summary.json
```

## Constraints

- Do not add React UI.
- Do not add animation code.
- Do not change the existing generated dataset format unless strictly necessary.
- Do not remove the audit information for excluded files/units.
- Keep ordering deterministic.
- Keep TypeScript/build clean.

## Validation

Run:

```bash
npm run summarize:animation-data -- --dataset data/generated/repo-animation-dataset.json --out data/generated/repo-animation-summary.json
npm run build
```

Both should pass.
