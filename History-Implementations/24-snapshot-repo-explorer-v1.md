# Prompt 24: Snapshot Repo Explorer V1

## Goal

Freeze the current repository explorer V1 so future V2 preprocessing/UI experiments do not break the working version.

This is not a redesign.  
The current repo explorer is good enough as V1 and should be preserved.

## What to snapshot

Snapshot these three things:

1. Current generated display model data
2. Current repo animation config
3. Current React repo explorer behavior through a V1 scene/route option

The important idea:

```txt
Repo Explorer V1 should read frozen V1 data.
Future Repo Explorer / V2 can keep reading the live generated data.
```

## 1. Freeze generated data

Copy the current generated display model:

```txt
public/data/repo-display-model.json
```

to:

```txt
public/data/snapshots/repo-display-model-v1.json
```

Create the directory if needed.

Do not regenerate or modify the V1 snapshot automatically after this.

## 2. Freeze the config too

Copy the current config:

```txt
repo-animation.config.json
```

to something like:

```txt
public/data/snapshots/repo-animation-config-v1.json
```

or, if you prefer not to expose config through `public`, use:

```txt
data/snapshots/repo-animation-config-v1.json
```

Pick the cleaner option for this repo.

The goal is only auditability: later I want to know which config generated the V1 snapshot.

## 3. Add a V1 scene or V1 data mode

Create a stable V1 entry point for the repo explorer.

Preferred clean implementation:

- Refactor the current repo scene slightly so the data URL is configurable.
- Keep the existing live repo scene reading:

```txt
/data/repo-display-model.json
```

- Add a V1 snapshot scene/mode reading:

```txt
/data/snapshots/repo-display-model-v1.json
```

Possible names:

```txt
RepoExplorerSceneV1
RepoExplorerV1
Repository V1
```

Avoid duplicating the entire scene file unless duplication is clearly simpler and safer.

Good option:

```tsx
<RepoExplorerScene modelUrl="/data/repo-display-model.json" />
<RepoExplorerScene modelUrl="/data/snapshots/repo-display-model-v1.json" snapshotLabel="V1 snapshot" />
```

Use whatever structure matches the current code best.

## 4. Update scene switcher

Update the app scene switcher so I can choose both:

```txt
Repository
Repository V1
```

or similar.

The current repository scene should stay available as the live/current version.

The V1 scene should be visibly distinguishable in a small, non-intrusive way, for example:

```txt
V1 snapshot
```

Do not add a big banner.

## 5. Keep the V1 behavior frozen

The V1 scene should behave like the current working explorer:

- file explorer rows
- connector lines
- floating playback controls
- collapsed/default display-model behavior
- hidden child activity mapped to parent rows
- no `+ N more`
- no old panel chrome
- no document scene changes

Do not introduce V2 behavior into the V1 scene.

## 6. Documentation

Update `README.md` with a short section:

```txt
Repo Explorer V1 snapshot
```

Explain:

- V1 reads `public/data/snapshots/repo-display-model-v1.json`
- live repo scene reads `public/data/repo-display-model.json`
- future preprocessing changes may affect the live scene but should not affect V1
- to intentionally refresh V1, manually copy the generated display model again

Also include the Git commands I should run manually after reviewing:

```bash
git add .
git commit -m "Snapshot repo explorer v1"
git tag repo-explorer-v1
```

Do not create the commit/tag automatically unless this repo's workflow already expects Codex to do git operations. Prefer documenting the commands.

## Important invariant

Preserve this invariant everywhere:

```txt
visual file/node geometry = actual replayed current line state / persistent line counts
```

Never do:

```txt
visual size = addedLines + deletedLines
```

Activity mass can drive:

```txt
glow
heat
pulse
timing
```

but not geometry.

Example:

```txt
+100 / -90
```

must not make the file look 190 lines bigger.

## Constraints

- Do not change preprocessing behavior in this prompt.
- Do not regenerate the display model unless needed only to ensure files exist.
- Do not touch the document/Word scene except scene-switcher labels if needed.
- Do not remove the current live repository scene.
- Do not add Remotion/export logic.
- Keep TypeScript/build clean.
- Prefer small refactor over copy-pasting huge scene files.
- If refactor risk is high, choose the safer minimal duplication.

## Validation

Run:

```bash
npm run build
```

If useful, also verify the live pipeline still works:

```bash
npm run build:animation-data -- --repo ../thesis-disi-chatbot --config repo-animation.config.json
npm run build
```

But be careful: after running the live pipeline, the V1 snapshot file must remain unchanged.

## Success criteria

- `public/data/snapshots/repo-display-model-v1.json` exists.
- Current config snapshot exists.
- App can open the live repository scene.
- App can open the frozen Repository V1 scene.
- V1 scene reads the frozen snapshot, not the live generated data.
- Running `build:animation-data` updates the live data but does not overwrite the V1 snapshot.
- README explains how to commit/tag the snapshot.
- `npm run build` passes.
