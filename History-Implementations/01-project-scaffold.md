# Codex Prompt — 01 Project Scaffold

You are working in a **new empty repository** for a small presentation animation project.

The final product will be a cool-looking UI animation for a thesis presentation. The first scene will eventually mock a Google Docs version-history style interface, but **this first implementation step is only the project scaffold**.

Do **not** build the full fake Google Doc scene yet. Do **not** add complex animation yet. Do **not** add Remotion yet. Keep this first step clean and boring so later implementation plans can build on it safely.

## Goal

Create a modern frontend scaffold using:

- Vite
- React
- TypeScript
- Tailwind CSS
- Motion / Framer Motion dependency installed for later animation work

The app should render a simple full-screen 16:9 presentation stage placeholder.

## Context

This project is for a short thesis-presentation visual interlude, not a full product UI. The visual should eventually support a fake Google Docs / version-history timelapse aesthetic. Later plans will add:

- fake Google Docs top bar
- document page
- version-history sidebar
- fake text blocks
- timeline/progression state
- polished animations
- presentation/recording controls

For this step, only prepare the foundation.

## Requirements

### 1. Initialize the app

Create a Vite React TypeScript project in the current repository.

Use the standard Vite layout unless there is a strong reason not to.

Expected scripts:

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview"
}
```

If the exact generated scripts differ slightly because of the current Vite template, keep them conventional and working.

### 2. Add Tailwind CSS

Set up Tailwind correctly for the Vite + React + TypeScript app.

Expected files can include:

```text
index.html
package.json
src/main.tsx
src/app/App.tsx
src/styles/globals.css
tailwind.config.ts
postcss.config.js or postcss.config.cjs
tsconfig files
vite.config.ts
```

Use Tailwind in the rendered UI to prove it is wired correctly.

### 3. Add Motion dependency

Install the current React animation library dependency that is appropriate for React UI animation.

Prefer the modern package if available:

```bash
npm install motion
```

If the project ecosystem or installed docs clearly point to Framer Motion instead, use:

```bash
npm install framer-motion
```

Do not build real animation yet. Just make sure the dependency is installed and the app still builds.

### 4. Create a clean folder structure

Use this starting structure:

```text
src/
  app/
    App.tsx
  scenes/
    PlaceholderScene.tsx
  components/
    presentation/
      PresentationStage.tsx
  styles/
    globals.css
```

Keep components small and obvious.

### 5. Render a placeholder presentation stage

The page should show a centered 16:9 stage on a dark background.

Inside the stage, render:

- a title: `Presentation Timelapse Lab`
- a subtitle: `Fake Google Docs scene scaffold`
- a small label/chip: `Step 01 · Project scaffold`
- a subtle placeholder rectangle where the future scene will live

Design direction:

- clean
- dark outer background
- light/soft card or stage
- presentation-friendly
- no noisy colors
- no unnecessary copy

The stage should stay visually usable on normal laptop screens.

### 6. Keep this step intentionally limited

Do **not** implement:

- Google Docs mock UI
- version-history sidebar
- fake document blocks
- playback controls
- keyboard controls
- Remotion export
- real timeline state
- repo/Git visualization
- external data loading

Those belong to later implementation prompts.

## Robustness expectations

- TypeScript should compile without errors.
- `npm run dev` should start the app.
- `npm run build` should pass.
- No unused complicated abstractions.
- No fake backend.
- No routing library unless strictly needed. For now, it is not needed.
- No CSS framework besides Tailwind.
- No component library unless strictly needed. For now, it is not needed.

## Suggested implementation steps

1. Initialize Vite React TypeScript.
2. Install dependencies.
3. Configure Tailwind.
4. Move `App.tsx` under `src/app/App.tsx`.
5. Create `PresentationStage.tsx`.
6. Create `PlaceholderScene.tsx`.
7. Import global styles from `src/main.tsx`.
8. Verify dev/build commands.
9. Remove boilerplate assets and unused template code.

## Acceptance criteria

The implementation is successful when:

```bash
npm install
npm run build
npm run dev
```

work without errors, and the browser shows a polished placeholder 16:9 presentation stage.

## Final response expected from Codex

After implementing, report briefly:

- files created/changed
- commands run
- whether `npm run build` passed
- anything intentionally deferred to the next prompt

Do not start implementing the next prompt.
