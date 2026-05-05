# 08 — Document content pass: make the paper look like the real extended design doc

## Context

This repo is a small React/Vite presentation-timelapse project. The current scene already has:

- a Word-like ribbon/top chrome,
- a central white document/paper rectangle,
- timeline controls at the bottom,
- milestone-driven content reveal logic.

The current document content still looks too much like a UI/dashboard mock. It contains fake labels and rounded card containers such as:

- `Thesis draft`
- `Interlude frame`
- `Revision view`
- `Focus`
- rounded section cards
- generic fake text blocks

This pass should make the actual white paper look more like my real extended thesis design Google Doc: a dense but readable technical design document with headings, paragraphs, bullets, short notes, and command/code-like snippets.

The goal is not to make a perfect Word clone. The goal is to make the paper content look like a real working thesis/design document instead of a presentation dashboard.

---

## Hard constraints

Do **not** add image generation.

Do **not** add Remotion.

Do **not** add the repo/file timelapse yet.

Do **not** reintroduce a right-side timeline/version-history sidebar.

Do **not** add page scrollbars. The whole scene must still fit in the viewport.

Do **not** copy any secrets, API keys, tokens, or credential-looking strings from source notes into the UI, code, or comments.

Do **not** copy rough scratch/profanity notes into the UI. Convert rough notes into clean thesis/design language or omit them.

Do **not** use rounded “app cards” inside the paper. The page should look like a document, not a dashboard.

---

## Files likely involved

Start by checking the current code. Expected files include:

- `src/data/docTimeline.ts`
- `src/components/google-doc/DocumentPage.tsx`
- `src/components/google-doc/DocShell.tsx`
- `src/components/google-doc/FakeTextBlock.tsx`
- `src/components/google-doc/StatusPill.tsx`
- `src/components/google-doc/CommentBubble.tsx`
- `src/components/google-doc/EditMarker.tsx`
- `src/styles/globals.css`

Modify only what is needed.

If a component becomes unused after this pass, either delete it or leave it only if it is still cleanly unused-free according to TypeScript/lint. Do not keep dead imports.

---

## Main goal

Replace the current fake/card-like paper content with a realistic compact thesis-design document.

The final page should visually feel like this kind of document:

```txt
Experimental ChatBot Thesis

Ingestion (V0 Collector → V1 Extractor)
V0 Collector = trusted-scope discovery/fetch + raw storage + manifest + crawl audit logs.
V1 Extractor = raw HTML/PDF → anchored extracted segments.

V0 - Collector
Web Fetching
- SeedSpider for seed-only collection and DiscoverySpider for trusted-scope link discovery.
- Each fetch records requested URL, final URL, canonical URL, status, content type, length, timestamp.
- Non-200 responses do not create revisions; they are logged for debugging.
- Politeness: robots.txt, throttling, retries, timeouts, max response size.

Discovery Policy
Controlled discovery starts from trusted hubs and follows only scoped links.
The policy separates pre-fetch eligibility, priority/budget class, and post-fetch storage.

V1 - Extractor
- HTML pages become anchored section/subsection text units.
- PDF documents become page-level text units.
- Anchors carry doc_id, revision_id, anchor type, anchor value, and segment order.

Indexing - BM25
Extracted segments are materialized into BM25 records and indexed into OpenSearch.
Ranking uses light tuning: title > heading > body, phrase-like matches, and duplicate PDF-family reduction.

Agent / Assistant
The assistant rewrites weak user queries, retrieves ranked passages, then answers only with citations.
If evidence is insufficient, it should ask for clarification or point to the relevant official source.
```

Use this style and structure. You do not need to use exactly this text word-for-word, but the visible content should clearly resemble the extended design doc.

---

## Required content structure

Update the timeline/document data so the document progresses through these milestones:

### M01 — Problem / thesis idea
Visible content:

- title: `Experimental ChatBot Thesis`
- short problem paragraph:
  - students struggle to find reliable bureaucratic university information,
  - official content is fragmented across PDFs, websites, regulations, and course pages,
  - the system should answer using trusted sources instead of unsupported general knowledge.

### M02 — Trusted sources / collector
Add content about:

- trusted UniTN scopes,
- seed/hub URLs,
- allowed domains/path prefixes,
- controlled discovery instead of autonomous crawling.

### M03 — Raw store / manifest / versioning
Add content about:

- raw storage,
- manifest database,
- `doc_id = sha1(canonical_url)`,
- doc-scoped `revision_id`,
- only storing a new revision when content changed,
- auditability/debugging.

### M04 — Extraction
Add content about:

- HTML → anchored section/subsection units,
- PDF → page-level units,
- stable metadata: `anchor_type`, `anchor_value`, `segment_order`, `doc_id`, `revision_id`,
- extractor versions.

### M05 — BM25 indexing/search
Add content about:

- extracted segments materialized into BM25 records,
- OpenSearch index,
- one record per segment,
- title/heading/body weighting,
- phrase-like matches,
- duplicate yearly PDF-family reduction.

### M06 — Assistant / citations
Add content about:

- query rewriting,
- retrieval before generation,
- grounded answer JSON/structured output idea,
- citations/actionable anchors,
- not-enough-evidence behavior.

### M07 — UI / final prototype narrative
Add content about:

- Catalogue page,
- Assistant page,
- Debug UI for inspecting ingestion/extraction/retrieval,
- final thesis narrative: from trusted source discovery to cited answers.

---

## Visual requirements for the paper

### Remove dashboard/card styling

Inside the white page, remove:

- rounded cards around each section,
- `StatusPill` labels such as `Interlude frame` and `Focus`,
- label-heavy UI text,
- fake dashboard wording,
- generic “staged document snapshot” copy.

### Use document typography

The paper should have:

- a plain document title,
- heading levels,
- normal paragraphs,
- bullets and numbered lists,
- occasional inline code-like text for technical terms,
- compact spacing so the final milestone still fits.

Suggested styling:

```txt
Title: larger, dark, document-like
H2: bold, maybe 14–16px
H3: bold/small caps optional, but not label-pill-like
Paragraph: 11–13px, readable line-height
Bullets: compact, indented
Code snippets: monospace inline, subtle gray background or no background
```

Do not make each section a separate “card”. Sections should flow vertically like a real document.

### Highlighting behavior

Keep milestone highlighting, but make it document-like.

Good options:

- a subtle yellow text-marker background behind the active heading,
- a thin left revision/change bar next to the active section,
- a light underline/highlight sweep.

Bad options:

- `Focus` pills,
- glowing cards,
- rounded highlighted panels,
- dashboard badges.

### Comments / notes

If comments are kept, they should look like small Word/Docs margin notes, not app cards.

Better option: reduce or remove comments for now if they clutter the page.

If kept, use only 1–2 small margin comments, for example:

- `Auditability` beside manifest/versioning,
- `Grounding` beside assistant/citations.

They must not dominate the page.

---

## Layout constraints

The white page must remain a simple rectangular paper surface.

The page may have a subtle shadow and border, but avoid rounded corners on the paper itself unless already present and very subtle. If there is rounding, make it minimal, not app-like.

Keep the Word-like ribbon above it for now, even if imperfect.

The bottom milestone controls remain the only timeline UI.

Avoid accidental viewport overflow:

- `body`, `#root`, and main stage should not scroll,
- bottom controls must stay visible,
- document content must fit inside the available stage,
- no horizontal scrollbar,
- no vertical scrollbar.

If the final M07 content is too much, compress the text rather than adding scroll.

---

## Data/model guidance

The current `docTimeline.ts` may still be shaped around fake text lines. Replace it with a data model that supports real document content.

A simple model is enough:

```ts
type DocBlock = {
  id: string
  title: string
  level: 1 | 2 | 3
  paragraphs?: string[]
  bullets?: string[]
  codeLines?: string[]
  emphasis?: 'active'
}
```

Or use another clean model if it fits the existing code better.

The important part: the data should read like a document outline, not UI mock data.

Keep timeline behavior data-driven:

- each milestone controls visible block IDs,
- each milestone controls the active/highlighted block IDs,
- controls still move through the milestones.

---

## Animation requirements

Keep the existing motion style, but adapt it to the document layout.

Use subtle animations:

- headings fade/slide in,
- bullets appear with small stagger,
- active section gets a marker/highlight.

Do not animate massive layout jumps.

Do not make it look like every paragraph is a separate app component.

---

## Validation

After changes:

1. Run the normal install/build checks for this repo.
2. Run TypeScript/lint checks if available.
3. Start the dev server and inspect the scene.
4. Confirm there are no page scrollbars.
5. Confirm the bottom controls do not overflow.
6. Confirm all milestones still work.
7. Confirm the final M07 page still fits without scrolling.

Add a short `dev-check.log` update if that is already the repo convention.

---

## Success criteria

This pass is successful when:

- the white paper looks like a real thesis/design document,
- the content resembles the extended thesis design notes,
- there are no useless labels like `Interlude frame` or `Focus`,
- there are no rounded card containers inside the page,
- the milestone progression still works,
- the scene remains recording-friendly with no scrollbars,
- no secrets or rough scratch notes are copied into the UI.

---

## Out of scope

Do not implement:

- autoplay,
- playback speed slider,
- Remotion export,
- repo/file popup animation,
- Google Docs/Drive integration,
- real document parsing,
- editable document behavior,
- new sidebars.
