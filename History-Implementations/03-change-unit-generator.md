# Prompt: Add repo change-unit generation

## Goal

Add the third preprocessing step: convert raw Git/file-state history into a **linear sequence of visual change units**.

Important idea:

- Commits are only used to preserve the order of changes.
- Animation time should be based on **change volume**, mostly added/deleted lines.
- A tiny 3-line change should occupy a tiny fraction of the timeline.
- A 200-line change should create many more units and therefore feel bigger/longer later in the UI.

No UI work in this prompt.

## Existing context

The repo already has:

- `scripts/extract-git-history.ts`
- `src/preprocessing/gitHistoryTypes.ts`
- `scripts/reconstruct-file-states.ts`
- `src/preprocessing/fileStateTypes.ts`
- `data/generated/raw-git-history.json`
- `data/generated/repo-file-states.json`

Use those as inputs. Do not redesign them unless a tiny type export is needed.

## Implement

Create:

- `scripts/generate-change-units.ts`
- `src/preprocessing/changeUnitTypes.ts`

Add an npm script:

```json
"generate:units": "tsx scripts/generate-change-units.ts"
```

Default CLI:

```bash
npm run generate:units -- \
  --history data/generated/raw-git-history.json \
  --states data/generated/repo-file-states.json \
  --out data/generated/repo-change-units.json
```

Also support optional:

```bash
--line-quantum 10
```

Meaning: one visual growth/shrink unit roughly represents 10 changed lines.

## Output shape

Write:

```txt
data/generated/repo-change-units.json
```

Suggested structure:

```ts
type RepoChangeUnitsOutput = {
  schemaVersion: 1;
  generatedAt: string;
  source: {
    historyPath: string;
    statesPath: string;
    lineQuantum: number;
  };
  summary: {
    commitCount: number;
    fileChangeCount: number;
    unitCount: number;
    totalAddedLines: number;
    totalDeletedLines: number;
    structuralUnitCount: number;
    growthUnitCount: number;
    shrinkUnitCount: number;
    warnings: string[];
  };
  units: RepoChangeUnit[];
};
```

Each unit should include enough information for a later React UI:

```ts
type RepoChangeUnit = {
  unitOrder: number;
  commitOrder: number;
  commitHash: string;
  filePath: string;
  previousPath?: string;
  type: "create" | "grow" | "shrink" | "delete" | "rename" | "copy" | "modify";
  statusFromGit: string;
  lineDelta: number | null;
  unitLineAmount: number | null;
  beforeLineCount: number | null;
  afterLineCount: number | null;
  extension: string;
  folder: string;
  visualMass: number;
};
```

Do not over-perfect the schema, but keep it explicit and typed.

## Unit generation rules

Use the raw Git history as the ordered list of changes.

For each file change:

1. Add a structural unit for `added`, `deleted`, `renamed`, `copied` when relevant.
2. For line growth/shrink:
   - `addedLines > 0` creates `grow` units.
   - `deletedLines > 0` creates `shrink` units.
   - Number of units should be based on `ceil(lines / lineQuantum)`.
3. For a pure small modification with no known line stats, create one `modify` unit.
4. Binary/unknown line stats should not crash. Use `null` line values and a small `visualMass`.
5. Preserve total ordering with a monotonically increasing `unitOrder`.

Example behavior:

- 3 added lines with `lineQuantum=10` → 1 grow unit.
- 200 added lines with `lineQuantum=10` → 20 grow units.
- Rename with no line change → 1 rename unit.
- Delete with 40 deleted lines → 1 delete unit + 4 shrink units.

## File state lookup

Use `repo-file-states.json` to enrich units with `beforeLineCount` and `afterLineCount` when possible.

Keep this simple:

- before = file state before the commit/file-change if available
- after = file state after the commit/file-change if available

If exact lookup is annoying, implement a robust approximate lookup and add warnings instead of failing.

## Constraints

- No React/UI changes.
- No animation code.
- No filtering/classification yet. That comes later.
- Do not remove or rewrite existing extractor/reconstructor behavior.
- Keep TypeScript strict/build clean.
- Make output deterministic.
- Create output directories if missing.
- Print a compact CLI summary after generation.

## Validation

Run:

```bash
npm run generate:units -- --history data/generated/raw-git-history.json --states data/generated/repo-file-states.json --out data/generated/repo-change-units.json
npm run build
```

Success criteria:

- `repo-change-units.json` is created.
- `units` is non-empty for a non-empty history.
- Big line changes create more units than tiny line changes.
- Binary/unknown line changes do not crash.
- `npm run build` passes.
