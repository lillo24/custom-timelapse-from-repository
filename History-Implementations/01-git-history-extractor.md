# 01 — Git history extractor

## Goal

Add the first preprocessing step for the repository timelapse.

This step should read the Git history of a target repository and write a raw JSON file containing commits and file-level changes.

No UI work in this prompt.

## Context

The final animation will not replay commits directly. Commits are only used to preserve the order of changes.

Later steps will convert the ordered Git changes into visual "growth units" based mostly on line additions/deletions.

For now, only extract clean raw history data.

## What to build

Create a Node/TypeScript script that can be run from this presentation/timelapse repo against another local Git repo.

Example command:

```bash
npm run extract:git -- --repo "C:/Users/leona/Documents/GitHub/thesis-disi-chatbot" --out "data/generated/raw-git-history.json"
```

Also support relative paths, for example:

```bash
npm run extract:git -- --repo ../thesis-disi-chatbot
```

If `--out` is not provided, default to:

```txt
data/generated/raw-git-history.json
```

## Output shape

Write JSON like this:

```ts
{
  "schemaVersion": 1,
  "sourceRepo": {
    "path": string,
    "currentHead": string
  },
  "generatedAt": string,
  "commits": [
    {
      "order": number,
      "hash": string,
      "shortHash": string,
      "authorName": string,
      "authorEmail": string,
      "date": string,
      "message": string,
      "parentHashes": string[],
      "changedFiles": [
        {
          "path": string,
          "oldPath": string | null,
          "status": "added" | "modified" | "deleted" | "renamed" | "copied" | "unknown",
          "addedLines": number | null,
          "deletedLines": number | null,
          "isBinary": boolean
        }
      ]
    }
  ]
}
```

Notes:

- `order` must be linear and stable, starting from `0`.
- Use Git order, not date sorting.
- `date` is only debug metadata. Do not use it for animation logic.
- For binary files, Git may return `-` for numstat. Store `addedLines: null`, `deletedLines: null`, `isBinary: true`.
- For renames, preserve both `oldPath` and `path`.

## Suggested implementation

Create something like:

```txt
scripts/
  extractGitHistory.ts
src/
  preprocessing/
    gitHistoryTypes.ts
```

Use Node child process calls to Git.

Useful Git commands:

```bash
git -C <repo> rev-list --reverse --topo-order HEAD
git -C <repo> show -s --format=%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%P%x1f%s <hash>
git -C <repo> diff-tree --root -r -M --name-status <hash>
git -C <repo> diff-tree --root -r -M --numstat <hash>
```

If merge commits make parsing noisy, use first-parent diff behavior, but document the choice clearly in code comments.

## Requirements

- Validate that `--repo` exists.
- Validate that `--repo` is a Git repository.
- Create the output directory if missing.
- Fail with clear errors when Git is missing or the repo path is invalid.
- Do not crash on binary files.
- Do not filter files yet. Filtering comes in a later prompt.
- Do not reconstruct file states yet.
- Do not create animation data yet.
- Do not touch the React UI.

## Package scripts

Add a package script:

```json
{
  "scripts": {
    "extract:git": "tsx scripts/extractGitHistory.ts"
  }
}
```

If `tsx` is not installed, add it as a dev dependency.

## Validation

After implementation, test with:

```bash
npm run extract:git -- --repo .
```

and with an external repo path if available.

Expected result:

```txt
data/generated/raw-git-history.json
```

containing a non-empty `commits` array.

Also run:

```bash
npm run build
```

Fix TypeScript errors if any.

## Out of scope

Do not add:

- React components
- file explorer UI
- animation
- timeline controls
- line-based growth units
- filtering/classification
- file state reconstruction

This prompt is only for raw Git history extraction.
