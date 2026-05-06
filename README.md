# Presentation Timelapse Lab

Small React, TypeScript, Vite, and Tailwind scaffold for a thesis-presentation
timelapse scene.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`

## Scope

This repository currently contains only the project foundation and a placeholder
16:9 presentation stage. The fake Google Docs scene, version-history UI, and
animation behavior are intentionally deferred to later implementation steps.

## Animation Data Filtering

`repo-animation.config.json` excludes implementation-plan folders and embedded
`.agents` skill material from the repo timelapse dataset. Those files are kept
auditable in preprocessing output, but they are not part of the thesis product
code evolution and would otherwise dominate the future visualization.
