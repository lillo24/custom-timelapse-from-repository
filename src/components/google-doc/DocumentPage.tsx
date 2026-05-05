import type { DocComment, DocSection } from '../../data/staticDocMock'
import { CommentBubble } from './CommentBubble'
import { FakeTextBlock } from './FakeTextBlock'
import { StatusPill } from './StatusPill'

type DocumentPageProps = {
  documentTitle: string
  sections: DocSection[]
  comments: DocComment[]
}

export function DocumentPage({
  documentTitle,
  sections,
  comments,
}: DocumentPageProps) {
  const commentsBySection = new Map(comments.map((comment) => [comment.sectionId, comment]))

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="w-full max-w-[780px] rounded-[34px] border border-slate-200/90 bg-[#fffdfa] shadow-[0_32px_90px_rgba(15,23,42,0.14)]">
        <div className="space-y-5 p-5 sm:p-6 lg:p-7">
          <header className="border-b border-slate-200/80 pb-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-slate-400">
                  Research workspace
                </p>
                <h2 className="mt-3 font-display text-[1.7rem] font-semibold tracking-[-0.05em] text-slate-900 sm:text-[2rem]">
                  {documentTitle}
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                  A static composition of the thesis pipeline, arranged as a
                  document snapshot with visible retrieval and citation
                  milestones.
                </p>
              </div>

              <div className="hidden shrink-0 flex-col items-end gap-2 sm:flex">
                <StatusPill tone="amber">Interlude frame</StatusPill>
                <p className="text-[10px] uppercase tracking-[0.28em] text-slate-400">
                  Screenshot ready
                </p>
              </div>
            </div>
          </header>

          <div className="space-y-3.5">
            {sections.map((section) => {
              const comment = commentsBySection.get(section.id)
              const highlighted = section.emphasis === 'highlight'

              return (
                <div
                  key={section.id}
                  className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3 sm:grid-cols-[minmax(0,1fr)_9.25rem] sm:gap-4"
                >
                  <section
                    className={[
                      'rounded-[24px] border p-4 sm:p-4.5',
                      highlighted
                        ? 'border-amber-200/90 bg-[linear-gradient(180deg,rgba(255,251,235,0.95),rgba(255,255,255,0.96))] shadow-[0_18px_34px_rgba(245,158,11,0.08)]'
                        : 'border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))]',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                          {section.eyebrow}
                        </p>
                        <h3 className="mt-2 font-display text-lg font-semibold tracking-[-0.03em] text-slate-900">
                          {section.title}
                        </h3>
                      </div>

                      {highlighted ? (
                        <StatusPill tone="amber" className="shrink-0">
                          Focus
                        </StatusPill>
                      ) : null}
                    </div>

                    {section.callout ? (
                      <div className="my-3 rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                          {section.callout.label}
                        </p>
                        <p className="mt-1 text-sm leading-5 text-slate-600">
                          {section.callout.text}
                        </p>
                      </div>
                    ) : null}

                    <FakeTextBlock lineWidths={section.lineWidths} />
                  </section>

                  <div className="pt-2">
                    {comment ? (
                      <CommentBubble
                        label={comment.label}
                        body={comment.body}
                        tone={comment.tone}
                      />
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
