# 06 — Add a preprocessing pipeline runner for the target repository

## Goal

Add one small orchestration step so I can generate the full repo-animation dataset for the actual target repository with one command.

Right now the preprocessing pieces work, but they are separate commands. Also, the current sample output was generated from this animation repo itself. For the real presentation I need to run the same pipeline against another repo, for example:

```bash
../thesis-disi-chatbot
```

No UI work in this prompt.

## What to add

Create a root-level script:

```txt
scripts/build-animation-data.ts
```

It should run the existing pipeline in order:

1. `extract-git-history`
2. `reconstruct-file-states`
3. `generate-change-units`
4. `filter-repo-animation-data`
5. `summarize-animation-data`

Add an npm script:

```json
"build:animation-data": "tsx scripts/build-animation-data.ts"
```

## CLI behavior

Support:

```bash
npm run build:animation-data -- --repo ../thesis-disi-chatbot
```

Optional args:

```txt
--out-dir data/generated
--line-quantum 5
--include-lockfiles
```

Default outputs should remain simple:

```txt
data/generated/raw-git-history.json
data/generated/repo-file-states.json
data/generated/repo-change-units.json
data/generated/repo-animation-dataset.json
data/generated/repo-animation-summary.json
```

## Important constraints

- Do not rewrite the existing scripts unless needed for clean reuse.
- Prefer calling/importing existing script logic if practical.
- If importing is messy, spawning the existing npm/script commands is acceptable.
- Keep deterministic output.
- No React/UI changes.
- No animation logic.
- No Remotion.

## Small classifier cleanup

Also fix the three current harmless `unknown` warnings:

- `.gitignore` should be classified as `config`.
- `index.html` should be classified as `ui` or `frontend`.
- `src/styles/globals.css` should be classified as `ui` or `frontend`, with language `CSS`.

Do not overbuild the classifier.

## Success criteria

These commands pass:

```bash
npm run build:animation-data -- --repo .
npm run build:animation-data -- --repo ../thesis-disi-chatbot
npm run build
```

After running on the real target repo, the summary should report many more than 2 commits if the target repo has real history.

The output should still include:

```txt
repo-animation-dataset.json
repo-animation-summary.json
```

These are the files the future UI will consume.
