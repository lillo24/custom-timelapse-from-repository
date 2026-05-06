# Prompt: Add a visual-model preview report

## Goal

Before starting the repository UI, add one small non-UI validation step for the generated visual model.

The visual model now exists, but we need a quick way to inspect whether it will animate well before building React components.

## Implement

Create a script like:

```bash
npm run preview:visual-model -- --model data/generated/repo-visual-model.json --out data/generated/repo-visual-model-preview.md
```

It should read `repo-visual-model.json` and write a human-readable Markdown report.

## Report content

Include:

- total files
- total folders
- total timeline units
- visual weight range
- largest visual files
- most active files by timeline units/activity weight
- top folders by file count
- top folders by total visual weight
- timeline density summary, for example first/middle/last chunks
- warnings if one file or folder visually dominates too much

## Important checks

Add warnings for cases like:

- one file has much larger visual weight than the rest
- one folder contains too much of the total visual weight
- too many timeline units target docs/meta/config instead of code/UI/backend/test files
- missing or empty folder/file structures
- non-monotonic timeline unit ordering

## Constraints

- Do not build any UI yet.
- Do not change the visual model schema unless strictly necessary.
- Do not change the Git extraction/filtering pipeline unless a real bug is found.
- Keep output deterministic.
- Keep `npm run build` passing.

## Success criteria

- `npm run preview:visual-model` creates `data/generated/repo-visual-model-preview.md`.
- The report is useful enough to decide whether the next UI prompt can start safely.
- Existing commands still pass:

```bash
npm run build
npm run build:animation-data -- --repo ../thesis-disi-chatbot --config repo-animation.config.json
```
