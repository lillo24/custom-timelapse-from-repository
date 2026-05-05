import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { DocBlockWithEmphasis, DocMarginNote } from '../../data/docTimeline'
import { useLayoutEffect, useRef, useState } from 'react'
import {
  getFadeSlideUp,
  getStaggerDelay,
  springSoft,
} from '../../lib/motionPresets'
import { CommentBubble } from './CommentBubble'

type DocumentPageProps = {
  documentTitle: string
  blocks: DocBlockWithEmphasis[]
  notes: DocMarginNote[]
}

export function DocumentPage({
  documentTitle,
  blocks,
  notes,
}: DocumentPageProps) {
  const shouldReduceMotion = useReducedMotion() ?? false
  const blockPresence = getFadeSlideUp(shouldReduceMotion, 18)
  const viewportRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLElement>(null)
  const [paperScale, setPaperScale] = useState(1)
  const [scaledPaperSize, setScaledPaperSize] = useState<{
    width: number
    height: number
  } | null>(null)
  const notesByBlock = notes.reduce<Map<string, DocMarginNote[]>>(
    (map, note) => {
      const existingNotes = map.get(note.blockId) ?? []
      map.set(note.blockId, [...existingNotes, note])
      return map
    },
    new Map(),
  )
  const leftColumnBlocks = blocks.filter((block) => block.column === 'left')
  const rightColumnBlocks = blocks.filter((block) => block.column === 'right')

  useLayoutEffect(() => {
    function measurePaper() {
      if (!viewportRef.current || !paperRef.current) {
        return
      }

      const viewportWidth = viewportRef.current.clientWidth
      const viewportHeight = viewportRef.current.clientHeight
      const naturalWidth = paperRef.current.offsetWidth
      const naturalHeight = paperRef.current.offsetHeight

      if (viewportWidth === 0 || viewportHeight === 0 || naturalWidth === 0 || naturalHeight === 0) {
        return
      }

      const nextScale = Math.min(
        viewportWidth / naturalWidth,
        viewportHeight / naturalHeight,
        1,
      )

      setPaperScale(nextScale)
      setScaledPaperSize({
        width: naturalWidth * nextScale,
        height: naturalHeight * nextScale,
      })
    }

    measurePaper()

    const resizeObserver = new ResizeObserver(() => {
      measurePaper()
    })

    if (viewportRef.current) {
      resizeObserver.observe(viewportRef.current)
    }

    if (paperRef.current) {
      resizeObserver.observe(paperRef.current)
    }

    window.addEventListener('resize', measurePaper)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', measurePaper)
    }
  }, [blocks, notes])

  function renderBlock(block: DocBlockWithEmphasis, blockIndex: number) {
    const blockNotes = notesByBlock.get(block.id) ?? []
    const highlighted = block.emphasis === 'highlight'
    const revealed = block.revealed !== false

    return (
      <motion.section
        key={block.id}
        layout
        initial={
          revealed ? blockPresence.initial : false
        }
        animate={
          revealed
            ? shouldReduceMotion
              ? blockPresence.animate
              : {
                  ...blockPresence.animate,
                  y: highlighted ? -1 : 0,
                }
            : shouldReduceMotion
              ? { opacity: 0 }
              : { opacity: 0, y: 0, scale: 1 }
        }
        transition={{
          ...springSoft,
          delay: shouldReduceMotion ? 0 : getStaggerDelay(blockIndex, 0.035),
        }}
        className={[
          'relative border-l px-3',
          revealed
            ? highlighted
              ? 'border-amber-300'
              : 'border-slate-200/90'
            : 'border-transparent',
        ].join(' ')}
        aria-hidden={!revealed}
      >
        <div className="space-y-1">
          <h2
            className={[
              'font-display font-semibold text-slate-900',
              block.level === 1
                ? 'text-[1.03rem] tracking-[-0.03em]'
                : block.level === 2
                  ? 'text-[12.5px] tracking-[-0.02em]'
                  : 'text-[10.25px] uppercase tracking-[0.2em] text-slate-500',
            ].join(' ')}
          >
            <span
              className={
                highlighted
                  ? 'box-decoration-clone bg-[linear-gradient(180deg,rgba(254,240,138,0.18),rgba(253,224,71,0.42))] px-1 py-0.5 -ml-1'
                  : ''
              }
            >
              {block.title}
            </span>
          </h2>

          {block.paragraphs?.map((paragraph) => (
            <p
              key={paragraph}
              className="text-[10.25px] leading-[1.36] text-slate-600"
            >
              {paragraph}
            </p>
          ))}

          {block.bullets?.length ? (
            <ul className="list-disc space-y-1 pl-3.5 text-[10px] leading-[1.34] text-slate-600 marker:text-slate-400">
              {block.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}

          {block.numberedItems?.length ? (
            <ol className="list-decimal space-y-1 pl-3.5 text-[10px] leading-[1.34] text-slate-600 marker:text-slate-400">
              {block.numberedItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          ) : null}

          {block.codeLines?.length ? (
            <div className="border border-slate-200/80 bg-slate-50/90 px-2 py-1.5 font-mono text-[9.25px] leading-[1.35] text-slate-600">
              {block.codeLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : null}

          {blockNotes.length ? (
            <div className="pt-0.5">
              <AnimatePresence>
                {blockNotes.map((note, noteIndex) => (
                  <CommentBubble
                    key={note.id}
                    label={note.label}
                    body={note.body}
                    tone={note.tone}
                    active={highlighted}
                    delay={
                      shouldReduceMotion
                        ? 0
                        : getStaggerDelay(noteIndex, 0.05)
                    }
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : null}
        </div>
      </motion.section>
    )
  }

  return (
    <div ref={viewportRef} className="flex h-full w-full items-center justify-center overflow-hidden">
      <div
        className="overflow-hidden"
        style={
          scaledPaperSize
            ? {
                width: `${scaledPaperSize.width}px`,
                height: `${scaledPaperSize.height}px`,
              }
            : undefined
        }
      >
        <article
          ref={paperRef}
          data-current-paper
          className="flex w-[884px] max-w-[884px] flex-col border border-slate-200/90 bg-white shadow-[0_28px_72px_rgba(15,23,42,0.13)]"
          style={{
            transform: `scale(${paperScale})`,
            transformOrigin: 'top center',
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col space-y-3 p-4 sm:p-5 lg:p-5">
            <header className="border-b border-slate-200/80 pb-2.5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-400">
                Extended design outline
              </p>
              <h1 className="mt-1.5 font-display text-[1.34rem] font-semibold tracking-[-0.05em] text-slate-900 sm:text-[1.52rem]">
                {documentTitle}
              </h1>
              <p className="mt-1 max-w-[42rem] text-[10px] leading-[1.4] text-slate-500">
                Trusted-source retrieval assistant for university information:
                scoped discovery, versioned raw storage, anchored extraction,
                BM25 retrieval, and cited answers.
              </p>
            </header>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] sm:gap-5">
              <div className="space-y-2.5">
                {leftColumnBlocks.map((block, blockIndex) =>
                  renderBlock(block, blockIndex),
                )}
              </div>

              <div className="space-y-2.5">
                {rightColumnBlocks.map((block, blockIndex) =>
                  renderBlock(
                    block,
                    leftColumnBlocks.length + blockIndex,
                  ),
                )}
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  )
}
