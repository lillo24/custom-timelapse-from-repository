export type LegacyDocSection = {
  id: string
  title: string
  eyebrow: string
  lineWidths: number[]
  callout?: {
    label: string
    text: string
  }
}

export type LegacyDocSectionWithEmphasis = LegacyDocSection & {
  emphasis?: 'highlight'
}

export type LegacyDocComment = {
  id: string
  sectionId: string
  label: string
  body: string
  tone?: 'sky' | 'amber'
}

type LegacyStepConfig = {
  visibleSectionIds: string[]
  highlightedSectionIds: string[]
  visibleCommentIds: string[]
}

export const legacyDocumentTitle = 'Thesis Design Notes'

export const legacyDocSections: LegacyDocSection[] = [
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

export const legacyDocComments: LegacyDocComment[] = [
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

const allSectionIds = legacyDocSections.map((section) => section.id)

const legacyStepConfigs: LegacyStepConfig[] = [
  {
    visibleSectionIds: ['problem'],
    highlightedSectionIds: ['problem'],
    visibleCommentIds: [],
  },
  {
    visibleSectionIds: ['problem', 'trusted-sources'],
    highlightedSectionIds: ['trusted-sources'],
    visibleCommentIds: [],
  },
  {
    visibleSectionIds: ['problem', 'trusted-sources', 'manifest-versioning'],
    highlightedSectionIds: ['manifest-versioning'],
    visibleCommentIds: ['comment-manifest'],
  },
  {
    visibleSectionIds: [
      'problem',
      'trusted-sources',
      'manifest-versioning',
      'extraction',
    ],
    highlightedSectionIds: ['extraction'],
    visibleCommentIds: ['comment-manifest'],
  },
  {
    visibleSectionIds: [
      'problem',
      'trusted-sources',
      'manifest-versioning',
      'extraction',
      'bm25-retrieval',
    ],
    highlightedSectionIds: ['bm25-retrieval'],
    visibleCommentIds: ['comment-manifest'],
  },
  {
    visibleSectionIds: [
      'problem',
      'trusted-sources',
      'manifest-versioning',
      'extraction',
      'bm25-retrieval',
      'assistant-citations',
    ],
    highlightedSectionIds: ['assistant-citations'],
    visibleCommentIds: ['comment-manifest', 'comment-citations'],
  },
  {
    visibleSectionIds: allSectionIds,
    highlightedSectionIds: ['bm25-retrieval', 'assistant-citations'],
    visibleCommentIds: ['comment-manifest', 'comment-citations'],
  },
]

const sectionById = new Map(legacyDocSections.map((section) => [section.id, section]))
const commentById = new Map(legacyDocComments.map((comment) => [comment.id, comment]))

function getRequiredItem<T>(items: Map<string, T>, id: string, type: string): T {
  const item = items.get(id)

  if (!item) {
    throw new Error(`Unknown ${type} id in legacy timeline data: ${id}`)
  }

  return item
}

function clampStepIndex(stepIndex: number) {
  return Math.min(Math.max(Math.trunc(stepIndex), 0), legacyStepConfigs.length - 1)
}

export function getLegacyTimelineFrame(stepIndex: number): {
  sections: LegacyDocSectionWithEmphasis[]
  comments: LegacyDocComment[]
} {
  const step = legacyStepConfigs[clampStepIndex(stepIndex)]
  const highlightedSectionIds = new Set(step.highlightedSectionIds)

  const sections = step.visibleSectionIds.map((sectionId) => {
    const section = getRequiredItem(sectionById, sectionId, 'section')

    return highlightedSectionIds.has(sectionId)
      ? { ...section, emphasis: 'highlight' as const }
      : section
  })

  const comments = step.visibleCommentIds.map((commentId) =>
    getRequiredItem(commentById, commentId, 'comment'),
  )

  return {
    sections,
    comments,
  }
}
