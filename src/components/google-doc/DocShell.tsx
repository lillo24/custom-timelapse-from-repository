import type {
  DocBlockWithEmphasis,
  DocMarginNote,
} from '../../data/docTimeline'
import type {
  LegacyDocComment,
  LegacyDocSectionWithEmphasis,
} from '../../data/legacyDocTimeline'
import { WordLikeRibbon } from '../document-editor/WordLikeRibbon'
import { DocumentPage } from './DocumentPage'
import { LegacyDocumentPage } from './LegacyDocumentPage'

export type DocumentVariant = 'current' | 'old'

type DocShellProps = {
  documentTitle: string
  legacyDocumentTitle: string
  blocks: DocBlockWithEmphasis[]
  notes: DocMarginNote[]
  legacySections: LegacyDocSectionWithEmphasis[]
  legacyComments: LegacyDocComment[]
  documentVariant: DocumentVariant
  onDocumentVariantChange: (variant: DocumentVariant) => void
}

export function DocShell({
  documentTitle,
  legacyDocumentTitle,
  blocks,
  notes,
  legacySections,
  legacyComments,
  documentVariant,
  onDocumentVariantChange,
}: DocShellProps) {
  const ribbonTitle =
    documentVariant === 'current' ? documentTitle : legacyDocumentTitle

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[30px] border border-slate-200/80 bg-[#f3f6fb] text-slate-900 shadow-[0_26px_70px_rgba(15,23,42,0.16)]">
      <WordLikeRibbon documentTitle={ribbonTitle} />

      <div className="relative min-h-0 flex-1 overflow-hidden bg-[linear-gradient(180deg,rgba(241,245,249,0.94),rgba(226,232,240,0.84))]">
        <div className="absolute -left-12 top-16 h-36 w-36 rounded-full bg-sky-200/35 blur-3xl" />
        <div className="absolute bottom-10 right-8 h-28 w-28 rounded-full bg-amber-100/60 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.45),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]" />
        <div className="absolute left-4 top-4 z-10 sm:left-5 sm:top-5">
          <div className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/92 p-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 shadow-[0_12px_24px_rgba(15,23,42,0.08)] backdrop-blur-sm">
            {(['current', 'old'] as const).map((variant) => {
              const active = variant === documentVariant

              return (
                <button
                  key={variant}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onDocumentVariantChange(variant)}
                  className={[
                    'rounded-full px-3 py-1 transition-[background-color,color,box-shadow] duration-200',
                    active
                      ? 'bg-slate-900 text-white shadow-[0_8px_18px_rgba(15,23,42,0.18)]'
                      : 'text-slate-500 hover:bg-slate-100/90',
                  ].join(' ')}
                >
                  {variant === 'current' ? 'Current' : 'Old'}
                </button>
              )
            })}
          </div>
        </div>

        <div className="relative flex h-full items-center justify-center px-4 py-4 sm:px-5 sm:py-5 lg:px-8 lg:py-6">
          {documentVariant === 'current' ? (
            <DocumentPage
              documentTitle={documentTitle}
              blocks={blocks}
              notes={notes}
            />
          ) : (
            <LegacyDocumentPage
              documentTitle={legacyDocumentTitle}
              sections={legacySections}
              comments={legacyComments}
            />
          )}
        </div>
      </div>
    </div>
  )
}
