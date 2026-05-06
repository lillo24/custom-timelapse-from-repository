# 08 - Pre-visual data cleanup

## Goal

Do a small cleanup pass before building the repository visual model.

The current preprocessing pipeline works, but some non-product / external instruction material is still included in the animation dataset. That material would visually dominate the future repo timelapse and make it look like the project is mostly prompt/agent configuration instead of thesis code.

## Main change

Update `repo-animation.config.json` so the generated dataset excludes the embedded `.agents` skill material, especially:

```txt
tools/ingestion_debug_ui_react_3/.agents/**
```

If the current matcher does not support this exact pattern, either:

1. add explicit supported patterns for the concrete paths under that folder, or
2. minimally improve the matcher so folder-prefix patterns like `some/path/**` work reliably.

Keep this change small. Do not rewrite the filtering system.

## Also do

- Add a short comment or README note explaining that `.agents` / external skill folders are excluded because they are not part of the thesis product code evolution.
- Re-run the full pipeline against the thesis repo:

```bash
npm run build:animation-data -- --repo ../thesis-disi-chatbot --config repo-animation.config.json
```

- Check that the summary no longer has `.agents/skills/...` among the largest files or top folders.
- Keep excluded files and units auditable with a clear reason such as `config-exclude: tools/ingestion_debug_ui_react_3/.agents/**`.

## Do not do

- Do not build the visual model yet.
- Do not build any UI.
- Do not add folder-growth logic yet.
- Do not change Git extraction.
- Do not change the line-volume unit generation model.
- Do not remove `History_Implementation_plans/**` from the exclusion config.

## Success criteria

- `npm run build` passes.
- The full pipeline command passes.
- `.agents` / skill material is excluded from `repo-animation-dataset.json`.
- `repo-animation-summary.json` confirms that these files are no longer visually dominant.
- Existing exclusions, especially `History_Implementation_plans/**`, still work.
