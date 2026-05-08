# Presentation Timelapse Lab

Small React, TypeScript, Vite, and Tailwind scaffold for a thesis-presentation
timelapse scene.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`
- `npm run preview:visual-model -- --model data/generated/repo-visual-model.json --out data/generated/repo-visual-model-preview.md`
- `npm run build:animation-data -- --repo ../thesis-disi-chatbot --config repo-animation.config.json`

## Scope

This repository currently contains only the project foundation and a placeholder
16:9 presentation stage. The fake Google Docs scene, version-history UI, and
animation behavior are intentionally deferred to later implementation steps.

## Animation Data Filtering

`repo-animation.config.json` excludes implementation-plan folders and embedded
`.agents` skill material from the repo timelapse dataset. Those files are kept
auditable in preprocessing output, but they are not part of the thesis product
code evolution and would otherwise dominate the future visualization.

`preview:visual-model` adds a non-UI Markdown inspection step so the generated
visual model can be checked for dominance and timeline-shape issues before the
React repository view is built.

`generate:visual-model` also mirrors the latest output into
`public/data/repo-visual-model.json` so the Vite app can load the repository
scene from generated data without hardcoding the dataset inside React.

## Repo Explorer V1 snapshot

The frozen V1 repository scene reads
`public/data/snapshots/repo-display-model-v1.json`.

The live repository scene continues to read
`public/data/repo-display-model.json`.

This means future preprocessing changes may affect the live repository scene
without changing Repository V1. The config used for the frozen snapshot is kept
in `data/snapshots/repo-animation-config-v1.json` for auditability.

To intentionally refresh V1, manually copy the current generated display model
into `public/data/snapshots/repo-display-model-v1.json` again after reviewing
the live output.

After reviewing the snapshot, run:

```bash
git add .
git commit -m "Snapshot repo explorer v1"
git tag repo-explorer-v1
```


# Tools for Fast Changes to Layout
## `maxVisibleRows` is currently advisory only in preprocessing
The display model records when the row count exceeds this budget, but it does not auto-collapse the tree.

## Changing gap between right line and text (gap-5)
className={`flex min-h-6 items-stretch gap-5 rounded-md px-2 py-0.5 text-[13px] leading-5 transition ${

## Changing right line length (12)
width: `${SIDEBAR_TREE_INDENT / 2 + 12}px`



# To improve
## Maybe some changes in config don't need the whole pipeline to start again (especially the downloading github history)

## Files may reach "maxVisibleRows" before later-root folders are born
Files may reach "maxVisibleRows" before later-root folders are born, may hide files of the new root folder instead of taking away from other root folders to let space to new one
