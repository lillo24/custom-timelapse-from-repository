# Presentation Timelapse Lab

Small React, TypeScript, Vite, and Tailwind scaffold for a thesis-presentation
timelapse scene.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`
- `npm run preview:visual-model -- --model data/generated/repo-visual-model.json --out data/generated/repo-visual-model-preview.md`

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
