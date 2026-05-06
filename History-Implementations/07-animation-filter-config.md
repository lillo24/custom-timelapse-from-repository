# Prompt: Add config-based include/exclude filtering for repo animation data

## Goal

Add a small config layer so I can choose which folders/files are tracked by the repository timelapse.

Main immediate fix: `History_Implementation_plans` / implementation-history folders should be excluded, because they are meta implementation prompts/plans, not real product/code evolution.

Do **not** change the raw Git extractor. Extract everything first, then filter later.

## Current context

The preprocessing pipeline already exists:

- `scripts/extract-git-history.ts`
- `scripts/reconstruct-file-states.ts`
- `scripts/generate-change-units.ts`
- `scripts/filter-repo-animation-data.ts`
- `scripts/summarize-animation-data.ts`
- `scripts/build-animation-data.ts`

The runner command is:

```bash
npm run build:animation-data -- --repo ../thesis-disi-chatbot
```

## What to add

### 1. Add a root config file

Create:

```txt
repo-animation.config.json
```

Suggested default:

```json
{
  "exclude": [
    "History_Implementation_plans/**",
    "History-Implementation-plans/**",
    "History-implementations/**",
    "history-implementation-plans/**",
    "data/raw/**",
    "data/generated/**",
    "node_modules/**",
    "dist/**",
    "build/**",
    "coverage/**",
    ".pytest_cache/**",
    ".mypy_cache/**",
    ".ruff_cache/**",
    "*.lock",
    "*.tsbuildinfo"
  ],
  "include": []
}
```

Meaning:

- `exclude` removes matching paths from the animation dataset.
- `include` is optional and empty by default. If non-empty, only matching paths are allowed unless excluded.
- Exclude wins over include.

Use slash-normalized relative paths.

### 2. Add config loading

Add shared types/helpers, for example:

```txt
src/preprocessing/animationFilterConfigTypes.ts
src/preprocessing/loadAnimationFilterConfig.ts
```

The helper should:

- load JSON config if provided;
- validate that `include` and `exclude` are arrays of strings;
- normalize path separators to `/`;
- return deterministic config;
- provide useful error messages for invalid config.

Using a `.gitignore`-style matcher is fine. Add a small dependency like `ignore` if useful.

### 3. Update filter step

Update:

```txt
scripts/filter-repo-animation-data.ts
```

Add:

```bash
--config repo-animation.config.json
```

Behavior:

- apply existing built-in filters as before;
- also apply config include/exclude rules;
- preserve excluded files/units in the audit output;
- use a clear reason such as:

```txt
config-exclude: History_Implementation_plans/**
config-include-miss
```

Do not silently drop anything.

### 4. Update pipeline runner

Update:

```txt
scripts/build-animation-data.ts
```

Add:

```bash
--config repo-animation.config.json
```

Default behavior:

- If `--config` is passed, use it.
- Else, if `repo-animation.config.json` exists in the current repo root, use it.
- Else, continue with built-in defaults.

The runner should pass the config to the filter step.

### 5. Update summary output

Update the summary if needed so it exposes:

```ts
filterConfig?: {
  path?: string;
  includeCount: number;
  excludeCount: number;
}
```

Also add counts/reasons for config exclusions if the current summary structure supports excluded reason breakdowns.

## Constraints

- Do **not** add UI.
- Do **not** change animation logic.
- Do **not** change raw Git extraction.
- Do **not** remove the existing built-in filters.
- Do **not** hardcode only `History_Implementation_plans`; the point is future configurable folder exclusion.
- Keep outputs deterministic.
- Keep TypeScript strict/build clean.

## Validation commands

Run:

```bash
npm run build
npm run build:animation-data -- --repo ../thesis-disi-chatbot --config repo-animation.config.json
```

Then check:

- `data/generated/repo-animation-dataset.json` exists;
- `data/generated/repo-animation-summary.json` exists;
- files under `History_Implementation_plans/**` or equivalent history implementation folders are excluded;
- excluded files/units still appear in audit data with a config reason;
- summary counts are deterministic.

## Success criteria

- I can exclude folders by editing `repo-animation.config.json`.
- `History_Implementation_plans` / implementation-history folders no longer pollute the animation dataset.
- The raw extraction still contains everything.
- The cleaned dataset and summary clearly explain what was excluded and why.
