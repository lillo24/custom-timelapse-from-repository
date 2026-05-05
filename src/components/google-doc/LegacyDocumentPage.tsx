import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type {
  LegacyDocComment,
  LegacyDocSectionWithEmphasis,
} from '../../data/legacyDocTimeline'
import {
  getFadeSlideUp,
  getScaleFade,
  getStaggerDelay,
  springSoft,
} from '../../lib/motionPresets'
import { EditMarker } from './EditMarker'
import { FakeTextBlock } from './FakeTextBlock'
import { LegacyCommentBubble } from './LegacyCommentBubble'
import { StatusPill } from './StatusPill'

type LegacyDocumentPageProps = {
  documentTitle: string
  sections: LegacyDocSectionWithEmphasis[]
  comments: LegacyDocComment[]
}

export function LegacyDocumentPage({
  documentTitle,
  sections,
  comments,
}: LegacyDocumentPageProps) {
  const shouldReduceMotion = useReducedMotion() ?? false
  const sectionPresence = getFadeSlideUp(shouldReduceMotion, 18)
  const markerPresence = getScaleFade(shouldReduceMotion)
  const commentsBySection = comments.reduce<Map<string, LegacyDocComment[]>>(
    (map, comment) => {
      const existingComments = map.get(comment.sectionId) ?? []
      map.set(comment.sectionId, [...existingComments, comment])
      return map
    },
    new Map(),
  )
  const splitIndex = Math.ceil(sections.length / 2)
  const leftColumnSections = sections.slice(0, splitIndex)
  const rightColumnSections = sections.slice(splitIndex)
  const shouldScaleToFit = sections.length > 4

  function renderSection(
    section: LegacyDocSectionWithEmphasis,
    sectionIndex: number,
  ) {
    const sectionComments = commentsBySection.get(section.id) ?? []
    const highlighted = section.emphasis === 'highlight'

    return (
      <motion.div
        key={section.id}
        layout
        initial={sectionPresence.initial}
        animate={sectionPresence.animate}
        exit={sectionPresence.exit}
        transition={{
          ...springSoft,
          delay: shouldReduceMotion ? 0 : getStaggerDelay(sectionIndex, 0.04),
        }}
        className="grid grid-cols-[minmax(0,1fr)_6.25rem] gap-2.5 sm:grid-cols-[minmax(0,1fr)_7.25rem] sm:gap-3"
      >
        <motion.section
          layout
          animate={
            shouldReduceMotion
              ? { opacity: 1 }
              : {
                  y: highlighted ? -2 : 0,
                  scale: highlighted ? 1.008 : 1,
                }
          }
          transition={springSoft}
          className={[
            'rounded-[20px] border p-3 transition-[transform,border-color,box-shadow,background-color] duration-300 sm:p-3.5',
            highlighted
              ? 'border-amber-200/90 bg-[linear-gradient(180deg,rgba(255,251,235,0.95),rgba(255,255,255,0.96))] shadow-[0_18px_34px_rgba(245,158,11,0.08)]'
              : 'border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))]',
          ].join(' ')}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                {section.eyebrow}
              </p>
              <h3 className="mt-1 font-display text-[0.96rem] font-semibold tracking-[-0.03em] text-slate-900 sm:text-[1rem]">
                {section.title}
              </h3>
            </div>

            <AnimatePresence>
              {highlighted ? (
                <motion.div
                  initial={markerPresence.initial}
                  animate={markerPresence.animate}
                  exit={markerPresence.exit}
                  transition={springSoft}
                >
                  <StatusPill tone="amber" className="shrink-0 px-2.5 py-0.5 text-[10px]">
                    Focus
                  </StatusPill>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {highlighted ? (
              <motion.div
                initial={markerPresence.initial}
                animate={markerPresence.animate}
                exit={markerPresence.exit}
                transition={{
                  ...springSoft,
                  delay: shouldReduceMotion ? 0 : 0.04,
                }}
                className="mt-2"
              >
                <EditMarker />
              </motion.div>
            ) : null}
          </AnimatePresence>

          {section.callout ? (
            <div className="my-2 rounded-2xl border border-slate-200/80 bg-white/80 px-2.5 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                {section.callout.label}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-slate-600">
                {section.callout.text}
              </p>
            </div>
          ) : null}

          <FakeTextBlock lineWidths={section.lineWidths} />
        </motion.section>

        <div className="space-y-2 pt-1">
          <AnimatePresence>
            {sectionComments.map((comment, commentIndex) => (
              <LegacyCommentBubble
                key={comment.id}
                label={comment.label}
                body={comment.body}
                tone={comment.tone}
                active={highlighted}
                delay={
                  shouldReduceMotion ? 0 : getStaggerDelay(commentIndex, 0.05)
                }
              />
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div
        data-legacy-paper
        className={[
          'w-full max-w-[900px] border border-slate-200/90 bg-white shadow-[0_28px_72px_rgba(15,23,42,0.13)]',
          shouldScaleToFit ? 'origin-center scale-[0.82]' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="space-y-3.5 p-4 sm:p-5 lg:p-5">
          <header className="border-b border-slate-200/80 pb-3.5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-400">
                  Thesis draft
                </p>
                <h2 className="mt-2 font-display text-[1.42rem] font-semibold tracking-[-0.05em] text-slate-900 sm:text-[1.7rem]">
                  {documentTitle}
                </h2>
                <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-slate-500">
                  A staged document snapshot of the thesis pipeline, arranged to
                  reveal retrieval and citation milestones across the
                  presentation timeline.
                </p>
              </div>

              <div className="hidden shrink-0 flex-col items-end gap-2 sm:flex">
                <StatusPill tone="amber">Interlude frame</StatusPill>
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">
                  Revision view
                </p>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
            <div className="space-y-3">
              <AnimatePresence>
                {leftColumnSections.map((section, sectionIndex) =>
                  renderSection(section, sectionIndex),
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-3">
              <AnimatePresence>
                {rightColumnSections.map((section, sectionIndex) =>
                  renderSection(
                    section,
                    leftColumnSections.length + sectionIndex,
                  ),
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
