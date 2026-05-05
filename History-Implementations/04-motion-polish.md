# 04 — Motion Polish for the Fake Google Doc Scene

## Goal

Add the first real animation layer to the fake Google Docs presentation scene.

The app should already have:

- a static fake Google-doc-like composition
- data-driven timeline steps
- manual timeline controls: previous, next, reset, optional step dots
- derived visible sections, comments, highlights, and active sidebar entry

This pass should make timeline changes feel like a polished thesis-presentation interlude.

Do **not** redesign the scene. Animate the existing structure.

---

## Current repo context

Expected relevant files after the previous implementation pass:

```txt
src/scenes/FakeGoogleDocScene.tsx
src/components/presentation/PresentationStage.tsx
src/components/google-doc/DocShell.tsx
src/components/google-doc/DocTopBar.tsx
src/components/google-doc/DocumentPage.tsx
src/components/google-doc/VersionHistorySidebar.tsx
src/components/google-doc/FakeTextBlock.tsx
src/components/google-doc/CommentBubble.tsx
src/components/google-doc/StatusPill.tsx
src/components/timeline/TimelineControls.tsx
src/data/docTimeline.ts
src/hooks/useDocTimeline.ts
src/styles/globals.css
```

If file names differ slightly because of the previous implementation, adapt with minimal changes. Do not restart from scratch.

The project already has the `motion` package installed. Use it as:

```ts
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
```

Do **not** add GSAP, Remotion, Three.js, canvas, or any other animation library in this pass.

---

## Important pre-check

Before implementing, verify install/build state.

If `npm ci` fails because `package-lock.json` is out of sync with `package.json`, run:

```bash
npm install
```

At the end, run:

```bash
npm run lint
npm run build
```

Fix any errors before finishing.

---

## Design direction

The animation should feel like:

```txt
Google Docs version history + thesis notes rapidly becoming structured
```

Not like:

```txt
terminal hacker typing
particle demo
generic landing page animation
```

Prefer:

- sections popping in
- comments appearing like review notes
- active sidebar version sliding/glowing
- highlighted document blocks pulsing softly
- fake text lines filling in quickly
- a small cursor/review marker moving to the current focus section

Avoid:

- slow letter-by-letter typing
- excessive bouncing
- heavy blur on many nodes
- massive layout movement
- distracting particle effects
- brand logos or exact Google branding

---

## Required implementation

### 1. Add shared motion settings

Create:

```txt
src/lib/motionPresets.ts
```

Export small reusable presets/constants, for example:

```ts
export const springSoft = {
  type: 'spring',
  stiffness: 260,
  damping: 28,
  mass: 0.9,
}

export const fadeSlideUp = {
  initial: { opacity: 0, y: 18, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.985 },
}
```

Keep this file small. Do not make an animation framework.

Also include a reduced-motion fallback helper if useful.

---

### 2. Animate document sections

Update `DocumentPage.tsx` so sections animate when they appear/disappear across timeline steps.

Use `AnimatePresence` around the mapped sections.

Each section card should:

- enter with opacity + slight vertical movement + slight scale
- exit quickly and cleanly
- use stable keys based on section id
- animate highlighted state smoothly

Expected feel:

```txt
Next step → new section pops into the document, older sections remain stable.
Previous step → later section leaves without breaking layout.
```

Do not make the document page jump aggressively. Keep the page readable at every step.

---

### 3. Animate fake text lines

Update `FakeTextBlock.tsx` so each fake line animates in.

A good effect:

- line fades in
- width grows from about 25–40% to the configured width
- tiny stagger between lines

Keep it subtle. The effect should read as “document content materializing,” not a loading skeleton.

Important:

- Do not randomize widths at render time.
- Keep output deterministic.
- Respect reduced motion.

---

### 4. Animate comments

Update `CommentBubble.tsx` and/or its parent rendering.

Comments should appear like review notes:

- scale from `0.96` to `1`
- fade in
- maybe slight x movement from the document margin
- soft pulse/glow only for the newly visible/active comment

Do not animate comments forever. Infinite pulse is allowed only if extremely subtle and limited to one active marker.

---

### 5. Animate the version-history sidebar

Update `VersionHistorySidebar.tsx`.

Requirements:

- sidebar entries should have a small staggered entrance on initial load
- active entry should transition smoothly
- active indicator dot should glow/pulse softly
- active card should shift slightly or gain depth
- inactive entries should remain readable, not disappear

If the current component receives `entries` with `active`, keep using that. Do not reintroduce hard-coded active state into the source data.

Also keep the dynamic count pill from the previous pass, for example `7 entries` based on `entries.length`.

---

### 6. Add one fake cursor / edit marker

Add a small visual marker that communicates “this version is being edited/reviewed.”

Suggested implementation:

```txt
src/components/google-doc/EditMarker.tsx
```

Behavior:

- appears near the currently highlighted section area
- can be rendered inside each highlighted section rather than calculating absolute page coordinates
- looks like a tiny cursor, reviewer avatar, or active edit pill
- animates in with the highlighted section
- remains subtle

Example visual text:

```txt
Editing
```

or

```txt
Live revision
```

Do not add a real text editor cursor system. Keep it fake and presentation-oriented.

---

### 7. Animate timeline controls lightly

Update `TimelineControls.tsx` only enough to feel consistent.

Requirements:

- current step label changes with a short fade/slide
- active step dot transitions smoothly
- buttons can have hover/press states

Do **not** add new controls yet.

No autoplay.  
No speed slider.  
No keyboard shortcuts.  
No fullscreen mode.

Those belong to the next pass.

---

## Reduced motion

Use `useReducedMotion()` where practical.

If reduced motion is enabled:

- avoid scale/bounce/stagger-heavy effects
- keep simple opacity changes
- app must remain fully usable

Do not over-engineer accessibility, but do not ignore it.

---

## Performance constraints

This scene is intended for screen recording and presentation use.

Keep animations mostly to:

```txt
opacity
transform
box-shadow / filter only sparingly
```

Avoid expensive repeated animations on many nodes:

- no large animated blur fields
- no hundreds of animated particles
- no setInterval animation loops
- no animation driven by random values
- no layout thrashing with measured DOM positions

The scene should stay smooth at 1920x1080 screen recording.

---

## Explicit non-goals

Do **not** implement these yet:

- autoplay
- speed slider
- keyboard controls
- fullscreen recording mode
- Remotion export
- route system
- backend
- real Google Docs API
- real Google Drive history
- Git/repository animation
- Obsidian/repository file popup animation
- changing the timeline content model
- major visual redesign
- localStorage persistence

---

## Quality expectations

- Preserve the existing static layout and thesis content.
- Keep animation code local to visual components.
- Keep timeline state logic in `useDocTimeline.ts` unchanged unless a tiny prop is needed.
- Keep TypeScript clean.
- No duplicated timeline logic in components.
- Components should still render correctly if only one section/comment is visible.
- Motion should enhance the visual story, not hide weak layout.

---

## Acceptance criteria

The work is complete when:

1. Clicking **Next** makes newly visible document sections animate in cleanly.
2. Clicking **Previous** removes later sections cleanly.
3. Fake text lines animate in without random behavior.
4. Comments appear with a review-note style motion.
5. The active version-history entry transitions smoothly.
6. Highlighted sections have a subtle active/revision feel.
7. A small fake edit marker appears on the current highlighted section.
8. Timeline controls have light transition/interaction polish.
9. Reduced-motion preference does not break the UI.
10. `npm run lint` passes.
11. `npm run build` passes.

---

## Report back

When finished, summarize briefly:

- files created
- files changed
- validation commands run
- any visual/technical tradeoff made
