# Prompt 18: Simplify and float the repo playback controls

## Goal

Clean up the repo scene controls.

Right now the `Timeline Position` / playback configuration area takes too much space and sits inside the normal repo layout.  
Move it into a small fixed floating control component so the file explorer gets more room.

Work only on the repository scene/control UI.

## What to change

### 1. Remove the old inline controls section

Find the current repo controls area that contains things like:

- `Timeline Position`
- duration buttons like `15s / 30s / 45s / 60s`
- speed buttons like `0.5x / 1x / 2x / 4x`
- progress slider
- play/reset/previous/next controls

Do not keep it inside the main repo layout.

Replace it with a floating control component.

## New control component behavior

Create a compact floating playback control.

Default mode: **simplified**.

In simplified mode show only:

- `Play / Pause`
- `Reset`
- a small `+` toggle button to reveal extra controls
- a small layout toggle button: `Vertical / Horizontal`
- progress slider
- duration selection: `15s / 30s / 45s / 60s`
- speed multiplier selection: `0.5x / 1x / 2x / 4x`

Expanded mode, opened by the `+` button, can show the extra/debug controls:

- Previous
- Next
- current unit label
- total units
- any other existing small debug label that is useful

Do not show the expanded/debug controls by default.

## Layout rules

### Vertical mode

Vertical is the default.

The floating component should be fixed on the right side of the viewport.

Suggested layout:

- top/left area: `Play`, `Reset`, `+`, layout toggle
- middle: progress slider
- bottom/right area: duration buttons and speed buttons

It should be narrow and compact, not a big panel.

### Horizontal mode

The layout toggle should switch the floating component to horizontal mode.

In horizontal mode:

- place the component fixed at the top of the viewport
- arrange controls horizontally
- keep it compact
- do not cover the scene too much

## Styling constraints

- No large dashboard panel.
- No heavy borders.
- No big background card.
- Use subtle glass/dark background only if needed for readability.
- Keep buttons small.
- Keep the progress bar readable.
- No page scrollbars.
- No layout overflow.
- The floating component must not push the repo explorer/content around.

## Important constraints

- Do not touch the document/Word scene.
- Do not change preprocessing.
- Do not change the visual model.
- Do not change the repo sidebar tree logic except as needed to free space.
- Do not change file-card geometry rules.
- Preserve the invariant: file geometry comes from replayed `currentLineCount`, not from `addedLines + deletedLines`.
- Activity mass may still drive glow/intensity only.

## Success criteria

- The repo scene has more visible space for the explorer.
- The old inline `Timeline Position` section is gone.
- Controls float on the right by default.
- User can switch controls to a top horizontal layout.
- Simplified controls are enough for normal playback.
- Extra controls are hidden behind the `+` toggle.
- `npm run build` passes.
