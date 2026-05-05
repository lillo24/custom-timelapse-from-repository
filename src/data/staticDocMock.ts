export type DocSection = {
  id: string
  title: string
  eyebrow: string
  lineWidths: number[]
  emphasis?: 'highlight'
  callout?: {
    label: string
    text: string
  }
}

export type VersionEntry = {
  id: string
  label: string
  milestone: string
  description: string
  active?: boolean
}

export type DocComment = {
  id: string
  sectionId: string
  label: string
  body: string
  tone?: 'sky' | 'amber'
}

export const documentTitle = 'Thesis Design Notes'

export const docSections: DocSection[] = [
  {
    id: 'problem',
    title: 'Problem',
    eyebrow: 'Context framing',
    lineWidths: [96, 88, 84],
  },
  {
    id: 'trusted-sources',
    title: 'Trusted UniTN Sources',
    eyebrow: 'Source policy',
    lineWidths: [92, 86, 73],
    callout: {
      label: 'Allowlist',
      text: 'Department pages, official guides, PDFs, and mirrored HTML.',
    },
  },
  {
    id: 'manifest-versioning',
    title: 'Manifest & Versioning',
    eyebrow: 'Storage contract',
    lineWidths: [94, 85, 68],
  },
  {
    id: 'extraction',
    title: 'Extraction',
    eyebrow: 'Normalization pass',
    lineWidths: [89, 82, 76],
  },
  {
    id: 'bm25-retrieval',
    title: 'BM25 Retrieval',
    eyebrow: 'Search baseline',
    lineWidths: [95, 87, 79],
    emphasis: 'highlight',
    callout: {
      label: 'Highlighted',
      text: 'Sparse retrieval becomes the first reliable answer path.',
    },
  },
  {
    id: 'assistant-citations',
    title: 'Assistant with Citations',
    eyebrow: 'Answer assembly',
    lineWidths: [93, 81, 71],
    callout: {
      label: 'Output rule',
      text: 'Responses must point back to manifest-backed sources.',
    },
  },
]

export const versionEntries: VersionEntry[] = [
  {
    id: 'initial-idea',
    label: 'Initial idea',
    milestone: 'M01',
    description: 'Scope the thesis assistant around trusted university content.',
  },
  {
    id: 'trusted-sources',
    label: 'Trusted sources',
    milestone: 'M02',
    description: 'Define which domains and documents are allowed into the crawl.',
  },
  {
    id: 'manifest-storage',
    label: 'Manifest storage',
    milestone: 'M03',
    description: 'Track revisions, provenance, and ingestion metadata.',
  },
  {
    id: 'extraction-baseline',
    label: 'Extraction baseline',
    milestone: 'M04',
    description: 'Split HTML and PDF content into cleaner text sections.',
  },
  {
    id: 'bm25-search',
    label: 'BM25 search',
    milestone: 'M05',
    description: 'Lock in a dependable retrieval layer before generation.',
    active: true,
  },
  {
    id: 'assistant-answers',
    label: 'Assistant answers',
    milestone: 'M06',
    description: 'Attach citations and response formatting to ranked passages.',
  },
  {
    id: 'presentation-polish',
    label: 'Presentation polish',
    milestone: 'M07',
    description: 'Turn the pipeline into a clear, visual thesis narrative.',
  },
]

export const comments: DocComment[] = [
  {
    id: 'comment-manifest',
    sectionId: 'manifest-versioning',
    label: 'Advisor note',
    body: 'Keep revision IDs visible so retrieval results stay explainable later.',
    tone: 'sky',
  },
  {
    id: 'comment-citations',
    sectionId: 'assistant-citations',
    label: 'Presentation note',
    body: 'Show source snippets in the final scene without turning it into a UI demo.',
    tone: 'amber',
  },
]
