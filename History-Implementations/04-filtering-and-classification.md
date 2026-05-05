# Codex Prompt: Add filtering and file classification for repo animation data

## Goal

Add the next preprocessing step only.

We already have:

- `data/generated/raw-git-history.json`
- `data/generated/repo-file-states.json`
- `data/generated/repo-change-units.json`

Now create a filtering/classification step that turns the raw/generated preprocessing data into a cleaner dataset for the future React visualization.

No UI yet.

## What to build

Add a script:

```txt
scripts/filter-repo-animation-data.ts
```

Add shared types if useful, for example:

```txt
src/preprocessing/animationDatasetTypes.ts
```

Add an npm script:

```json
"filter:animation-data": "tsx scripts/filter-repo-animation-data.ts"
```

Default command:

```bash
npm run filter:animation-data -- --history data/generated/raw-git-history.json --states data/generated/repo-file-states.json --units data/generated/repo-change-units.json --out data/generated/repo-animation-dataset.json
```

## Output

Write:

```txt
data/generated/repo-animation-dataset.json
```

Suggested shape:

```ts
{
  generatedAt: string;
  sourceFiles: {
    history: string;
    states: string;
    units: string;
  };
  filters: {
    excludedPatterns: string[];
    includeLockfiles: boolean;
  };
  files: AnimationFile[];
  units: AnimationUnit[];
  excludedFiles: ExcludedFile[];
  warnings: string[];
}
```

Each included file should have enough metadata for the future UI:

```ts
{
  path: string;
  name: string;
  folder: string;
  extension: string;
  category: "source" | "test" | "config" | "docs" | "data" | "ui" | "backend" | "script" | "unknown";
  language?: string;
  maxLineCount: number;
  finalLineCount: number;
  createdUnitOrder?: number;
  deletedUnitOrder?: number;
}
```

Keep the existing units, but remove units for excluded files and attach useful classification metadata to them where practical.

## Default exclusions

Exclude obvious generated/cache/dependency/build artifacts:

```txt
node_modules/**
dist/**
build/**
coverage/**
.pytest_cache/**
__pycache__/**
.venv/**
venv/**
data/raw/**
data/generated/**
*.pyc
*.pyo
*.log
```

Lockfiles should be excluded by default, but allow:

```bash
--include-lockfiles
```

Default excluded lockfiles:

```txt
package-lock.json
pnpm-lock.yaml
yarn.lock
poetry.lock
```

Do not delete information silently. Put excluded paths in `excludedFiles` with a reason.

## Classification rules

Use simple deterministic rules. No AI.

Examples:

- `*.test.ts`, `*.spec.ts`, `tests/**` => `test`
- `*.tsx`, `*.jsx`, `src/components/**`, `frontend/**` => `ui`
- `backend/**`, `server/**`, `api/**`, `*.py` in backend-like folders => `backend`
- `scripts/**` => `script`
- `*.md`, `docs/**` => `docs`
- config files like `vite.config.ts`, `tsconfig*.json`, `.eslintrc*`, `tailwind.config.*` => `config`
- data files like `*.json`, `*.csv`, `*.toml`, `*.yaml`, `*.yml` => `data`, unless they are clearly config

Keep the rules small and readable. This is for visualization, not perfect static analysis.

## CLI options

Support:

```txt
--history <path>
--states <path>
--units <path>
--out <path>
--include-lockfiles
```

Optional but useful:

```txt
--exclude <glob>
```

If implementing `--exclude` is too much, skip it and keep the built-in exclusions.

## Constraints

- Do not add any React UI.
- Do not add animation logic.
- Do not change the previous extractor/reconstructor/unit-generator behavior unless needed for type sharing.
- Do not mutate the input JSON files.
- Keep deterministic ordering.
- Keep TypeScript/build clean.
- Keep the implementation simple and inspectable.

## Validation

Run:

```bash
npm run filter:animation-data -- --history data/generated/raw-git-history.json --states data/generated/repo-file-states.json --units data/generated/repo-change-units.json --out data/generated/repo-animation-dataset.json
npm run build
```

Print a short summary, for example:

```txt
Included files: 38
Excluded files: 4
Included units: 910
Excluded units: 74
Categories: source=12, ui=8, config=6, docs=4, test=8
Warnings: 0
```

## Success criteria

- `data/generated/repo-animation-dataset.json` exists.
- Generated/cache/build/dependency files are excluded.
- Excluded files are still reported with reasons.
- Included files have category/language/folder/extension metadata.
- Units for excluded files are removed from the clean dataset.
- `npm run build` passes.
