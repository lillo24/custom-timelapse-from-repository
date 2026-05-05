# Codex Prompt: 02 - File State Reconstructor

## Goal

Add the second preprocessing step: reconstruct the repository file state after each commit, using the raw Git history JSON created by the previous extractor.

This is still **preprocessing only**. No UI, no animation, no filtering, no visual layout.

## Current context

The repo already has:

- `scripts/extract-git-history.ts`
- `src/preprocessing/gitHistoryTypes.ts`
- npm script: `extract:git`
- generated input: `data/generated/raw-git-history.json`

The raw extractor keeps commits in order and records changed files with statuses, rename/copy metadata, `addedLines`, and `deletedLines`.

## What to add

Create a new script:

```txt
scripts/reconstruct-file-states.ts
```

Add shared output types in:

```txt
src/preprocessing/fileStateTypes.ts
```

Add an npm script:

```json
"reconstruct:states": "tsx scripts/reconstruct-file-states.ts"
```

Default input/output:

```txt
--in data/generated/raw-git-history.json
--out data/generated/repo-file-states.json
```

Example command:

```bash
npm run reconstruct:states -- --in data/generated/raw-git-history.json --out data/generated/repo-file-states.json
```

## Output shape

Create `data/generated/repo-file-states.json` with roughly this structure:

```ts
{
  metadata: {
    generatedAt: string;
    inputPath: string;
    commitCount: number;
    stepCount: number;
    warningCount: number;
  };
  steps: FileStateStep[];
  warnings: string[];
}
```

Each step represents the repository state **after one commit**:

```ts
{
  stepIndex: number;
  commitHash: string;
  commitOrder: number;
  commitMessage: string;
  totals: {
    existingFiles: number;
    totalKnownLines: number;
    unknownLineFiles: number;
    changedFiles: number;
    addedLines: number;
    deletedLines: number;
  };
  changedPaths: string[];
  files: RepoFileState[];
}
```

Each file state should include:

```ts
{
  path: string;
  name: string;
  folder: string;
  extension: string;
  exists: true;
  lineCount: number | null;
  lineCountUnknown: boolean;
  createdOrder: number;
  firstSeenCommit: string;
  lastChangedCommit: string;
  changeCount: number;
  accumulatedAddedLines: number;
  accumulatedDeletedLines: number;
}
```

Keep `files` sorted by path for stable output.

## Reconstruction rules

Use the raw commit order as the only order source.

Maintain a mutable map:

```ts
Map<string, RepoFileState>
```

Apply file changes in order:

- `added`: create file state. If `addedLines` is known, use it as initial `lineCount`; otherwise set `lineCount: null` and `lineCountUnknown: true`.
- `modified`: update existing file line count with `addedLines - deletedLines` when known. Clamp at `0`. If the file does not exist yet, create a placeholder state and add a warning.
- `deleted`: remove the file from the current state.
- `renamed`: move state from `previousPath` to `path`, then apply known line delta if present. If the previous path does not exist, create a placeholder and add a warning.
- `copied`: clone state from `previousPath` if available; otherwise create a new state from known added lines and add a warning.
- binary/unknown line stats: preserve the file, but set/keep `lineCountUnknown: true` when line counts cannot be trusted.

Do not read the target Git repo in this step. This script should consume only the raw JSON.

## Important constraints

- Do not add UI code.
- Do not add animation code.
- Do not filter files yet. Keep lockfiles, generated files, etc. Filtering comes later.
- Do not group commits.
- Do not split commits into visual units yet.
- Do not overwrite the raw history extractor.
- Keep TypeScript strict/build clean.

## Validation

After implementation, run:

```bash
npm run reconstruct:states -- --in data/generated/raw-git-history.json --out data/generated/repo-file-states.json
npm run build
```

Print a short CLI summary, for example:

```txt
Reconstructed 123 commit states.
Current files: 84
Known lines: 12450
Unknown-line files: 3
Warnings: 0
Wrote data/generated/repo-file-states.json
```

## Success criteria

- `data/generated/repo-file-states.json` is created.
- It has one step per raw commit.
- Each step contains the current file state after that commit.
- File growth/shrink is represented through changing `lineCount`.
- Deleted files disappear from later step snapshots.
- Renamed files keep continuity when possible.
- `npm run build` passes.
