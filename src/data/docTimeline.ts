export type DocBlock = {
  id: string
  title: string
  level: 1 | 2 | 3
  column: 'left' | 'right'
  paragraphs?: string[]
  bullets?: string[]
  numberedItems?: string[]
  codeLines?: string[]
}

export type DocBlockWithEmphasis = DocBlock & {
  emphasis?: 'highlight'
  revealed?: boolean
}

export type DocMarginNote = {
  id: string
  blockId: string
  label: string
  body: string
  tone?: 'sky' | 'amber'
}

export type DocTimelineStep = {
  id: string
  label: string
  subtitle: string
  visibleBlockIds: string[]
  highlightedBlockIds: string[]
  visibleNoteIds: string[]
}

export const documentTitle = 'Experimental ChatBot Thesis'

export const docBlocks: DocBlock[] = [
  {
    id: 'problem',
    title: 'Problem framing',
    level: 2,
    column: 'left',
    paragraphs: [
      'Students struggle to find reliable bureaucratic university information because official rules are fragmented across PDFs, course pages, departmental websites, and regulations.',
      'The thesis proposes a trusted-source assistant that answers from UniTN material only, instead of relying on unsupported general knowledge.',
    ],
  },
  {
    id: 'trusted-sources',
    title: 'Trusted sources and collector policy',
    level: 2,
    column: 'left',
    paragraphs: [
      'Collection starts from trusted UniTN hubs and follows only allowlisted domains and path prefixes. Discovery is controlled rather than autonomous crawling.',
    ],
    bullets: [
      'Seed hubs include admissions, student services, departments, degree-programme pages, and official guide repositories.',
      'Pre-fetch policy decides scope eligibility, crawl budget class, and whether HTML pages or attached PDFs are permitted.',
      'Politeness rules include robots.txt checks, throttling, retries, timeouts, and response-size limits.',
    ],
  },
  {
    id: 'manifest-versioning',
    title: 'Raw store, manifest, and versioning',
    level: 2,
    column: 'left',
    paragraphs: [
      'Every fetch writes raw content plus a manifest row used for provenance, debugging, and later retrieval inspection.',
    ],
    bullets: [
      '`doc_id = sha1(canonical_url)` gives a stable document identifier across mirrored links.',
      'Each document owns its own `revision_id`, and a new revision is stored only when normalized content changes.',
      'Requested URL, final URL, canonical URL, status, content type, byte length, and fetch timestamp remain queryable for auditability.',
    ],
    codeLines: [
      'doc_id = sha1(canonical_url)',
      'if normalized_content_hash changed => store new revision',
    ],
  },
  {
    id: 'extraction',
    title: 'V1 extraction and anchored segments',
    level: 2,
    column: 'left',
    paragraphs: [
      'The extractor converts raw HTML and PDF revisions into stable text units that can be cited, ranked, and inspected later.',
    ],
    bullets: [
      'HTML becomes section and subsection units tied to heading-derived anchors.',
      'PDF files fall back to page-level units when layout is complex or headings are unreliable.',
      'Each segment carries `anchor_type`, `anchor_value`, `segment_order`, `doc_id`, `revision_id`, and `extractor_version`.',
    ],
    codeLines: [
      'segment_key = { doc_id, revision_id, anchor_type, anchor_value, segment_order }',
    ],
  },
  {
    id: 'bm25-indexing',
    title: 'BM25 indexing and retrieval',
    level: 2,
    column: 'right',
    paragraphs: [
      'Extracted segments are materialized into one BM25 record per segment and indexed into OpenSearch as the first dependable retrieval layer.',
    ],
    bullets: [
      'Records separate title, heading, body, source URL, canonical URL, and document metadata.',
      'Ranking gives extra weight to title and heading hits, phrase-like matches, and cleaner canonical copies.',
      'Duplicate yearly PDF families are reduced so mirrored handbook variants do not dominate the result list.',
    ],
    codeLines: [
      'index record = { segment_id, title, heading, body, source_url, doc_id, revision_id }',
    ],
  },
  {
    id: 'assistant-citations',
    title: 'Assistant behavior and citations',
    level: 2,
    column: 'right',
    paragraphs: [
      'The assistant rewrites weak user queries, retrieves evidence before generation, and returns grounded answers with actionable anchors.',
    ],
    bullets: [
      'A structured response can carry answer text, cited anchors, source URLs, and a status such as `grounded` or `needs_clarification`.',
      'If evidence is missing, sparse, or contradictory, the system asks for clarification or points back to the relevant official source.',
      'Generation should never invent regulations or deadlines that were not supported by retrieved passages.',
    ],
    codeLines: [
      '{ answer, citations: [doc_id + "#" + anchor_value], status }',
    ],
  },
  {
    id: 'prototype-narrative',
    title: 'UI surfaces and final thesis narrative',
    level: 2,
    column: 'right',
    paragraphs: [
      'The final prototype turns the pipeline into a readable thesis story: trusted discovery, versioned storage, anchored retrieval, and cited answers.',
    ],
    numberedItems: [
      'Catalogue page for browsing sources, revisions, scope filters, and crawl outcomes.',
      'Assistant page for grounded answers with visible anchors and source jumps.',
      'Debug UI for inspecting ingestion, extraction, and retrieval decisions for a document or query.',
    ],
    bullets: [
      'The final presentation arc should move cleanly from trusted source discovery to cited assistant answers.',
    ],
  },
]

export const docNotes: DocMarginNote[] = [
  {
    id: 'note-auditability',
    blockId: 'manifest-versioning',
    label: 'Auditability',
    body: 'Manifest rows keep the fetch path, revision lineage, and failure context visible during evaluation.',
    tone: 'sky',
  },
  {
    id: 'note-grounding',
    blockId: 'assistant-citations',
    label: 'Grounding',
    body: 'The answer format should cite exact anchors so the demo reads like a research tool, not a general chatbot.',
    tone: 'amber',
  },
]

const allBlockIds = docBlocks.map((block) => block.id)

export const timelineSteps: DocTimelineStep[] = [
  {
    id: 'm01-problem',
    label: 'M01',
    subtitle: 'Problem / thesis idea',
    visibleBlockIds: ['problem'],
    highlightedBlockIds: ['problem'],
    visibleNoteIds: [],
  },
  {
    id: 'm02-trusted-sources',
    label: 'M02',
    subtitle: 'Trusted sources / collector',
    visibleBlockIds: ['problem', 'trusted-sources'],
    highlightedBlockIds: ['trusted-sources'],
    visibleNoteIds: [],
  },
  {
    id: 'm03-raw-store',
    label: 'M03',
    subtitle: 'Raw store / manifest / versioning',
    visibleBlockIds: ['problem', 'trusted-sources', 'manifest-versioning'],
    highlightedBlockIds: ['manifest-versioning'],
    visibleNoteIds: ['note-auditability'],
  },
  {
    id: 'm04-extraction',
    label: 'M04',
    subtitle: 'Extraction',
    visibleBlockIds: [
      'problem',
      'trusted-sources',
      'manifest-versioning',
      'extraction',
    ],
    highlightedBlockIds: ['extraction'],
    visibleNoteIds: ['note-auditability'],
  },
  {
    id: 'm05-bm25-indexing',
    label: 'M05',
    subtitle: 'BM25 indexing / search',
    visibleBlockIds: [
      'problem',
      'trusted-sources',
      'manifest-versioning',
      'extraction',
      'bm25-indexing',
    ],
    highlightedBlockIds: ['bm25-indexing'],
    visibleNoteIds: ['note-auditability'],
  },
  {
    id: 'm06-assistant-citations',
    label: 'M06',
    subtitle: 'Assistant / citations',
    visibleBlockIds: [
      'problem',
      'trusted-sources',
      'manifest-versioning',
      'extraction',
      'bm25-indexing',
      'assistant-citations',
    ],
    highlightedBlockIds: ['assistant-citations'],
    visibleNoteIds: ['note-auditability', 'note-grounding'],
  },
  {
    id: 'm07-prototype-narrative',
    label: 'M07',
    subtitle: 'UI / final prototype narrative',
    visibleBlockIds: allBlockIds,
    highlightedBlockIds: ['prototype-narrative'],
    visibleNoteIds: ['note-auditability', 'note-grounding'],
  },
]

const noteById = new Map(docNotes.map((note) => [note.id, note]))

function getRequiredItem<T>(items: Map<string, T>, id: string, type: string): T {
  const item = items.get(id)

  if (!item) {
    throw new Error(`Unknown ${type} id in timeline data: ${id}`)
  }

  return item
}

export function getTimelineFrame(step: DocTimelineStep): {
  blocks: DocBlockWithEmphasis[]
  notes: DocMarginNote[]
} {
  const visibleBlockIds = new Set(step.visibleBlockIds)
  const highlightedBlockIds = new Set(step.highlightedBlockIds)

  const blocks = docBlocks.map((block) => {
    const revealed = visibleBlockIds.has(block.id)

    if (!revealed) {
      return {
        ...block,
        revealed: false,
      }
    }

    return highlightedBlockIds.has(block.id)
      ? {
          ...block,
          emphasis: 'highlight' as const,
          revealed: true,
        }
      : {
          ...block,
          revealed: true,
        }
  })

  const notes = step.visibleNoteIds.map((noteId) =>
    getRequiredItem(noteById, noteId, 'note'),
  )

  return {
    blocks,
    notes,
  }
}
