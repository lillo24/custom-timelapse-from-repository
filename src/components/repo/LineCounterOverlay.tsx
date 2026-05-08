import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { springSoft } from '../../lib/motionPresets'
import type { RepoDisplayTimelineUnit } from '../../preprocessing/displayModelTypes'

type ViewportBounds = {
  top: number
  right: number
  bottom: number
  left: number
  width: number
  height: number
}

type LineCounterOverlayProps = {
  timeline: RepoDisplayTimelineUnit[]
  activeUnitIndex: number
  shouldReduceMotion: boolean
  stageBounds: ViewportBounds | null
}

type CounterBadgeState = {
  id: number
  delta: number
}

const BADGE_APPEAR_DURATION_SECONDS = 0.1
const BADGE_HOLD_DURATION_SECONDS = 0.25
const BADGE_MERGE_DURATION_SECONDS = 0.3
const BADGE_TOTAL_DURATION_MS =
  (BADGE_APPEAR_DURATION_SECONDS +
    BADGE_HOLD_DURATION_SECONDS +
    BADGE_MERGE_DURATION_SECONDS) *
  1000

export function LineCounterOverlay({
  timeline,
  activeUnitIndex,
  shouldReduceMotion,
  stageBounds,
}: LineCounterOverlayProps) {
  const cumulativeLineTotals = useMemo(() => buildCumulativeLineTotals(timeline), [timeline])
  const clampedActiveUnitIndex =
    timeline.length > 0 ? clampNumber(activeUnitIndex, 0, timeline.length - 1) : -1
  const targetTotal =
    clampedActiveUnitIndex >= 0 ? cumulativeLineTotals[clampedActiveUnitIndex] ?? 0 : 0
  const initialTimelineTotal = useMemo(() => targetTotal, [timeline])
  const [displayedTotal, setDisplayedTotal] = useState(targetTotal)
  const [badge, setBadge] = useState<CounterBadgeState | null>(null)
  const displayedTotalRef = useRef(targetTotal)
  const observedTotalRef = useRef(targetTotal)
  const pendingDeltaRef = useRef(0)
  const badgeIdRef = useRef(0)
  const mergeTimeoutRef = useRef<number | null>(null)
  const isBadgeAnimatingRef = useRef(false)

  const clearBadgeTimeout = () => {
    if (mergeTimeoutRef.current !== null) {
      window.clearTimeout(mergeTimeoutRef.current)
      mergeTimeoutRef.current = null
    }
  }

  const cancelBadgeCycle = () => {
    clearBadgeTimeout()
    isBadgeAnimatingRef.current = false
    setBadge(null)
  }

  const startBadgeCycle = () => {
    if (pendingDeltaRef.current === 0) {
      return
    }

    isBadgeAnimatingRef.current = true
    badgeIdRef.current += 1
    setBadge({
      id: badgeIdRef.current,
      delta: pendingDeltaRef.current,
    })

    mergeTimeoutRef.current = window.setTimeout(() => {
      const mergeDelta = pendingDeltaRef.current

      if (mergeDelta !== 0) {
        const nextDisplayedTotal = Math.max(0, displayedTotalRef.current + mergeDelta)
        displayedTotalRef.current = nextDisplayedTotal
        pendingDeltaRef.current = 0
        setDisplayedTotal(nextDisplayedTotal)
      }

      setBadge(null)
      isBadgeAnimatingRef.current = false
      mergeTimeoutRef.current = null

      if (observedTotalRef.current !== displayedTotalRef.current) {
        pendingDeltaRef.current += observedTotalRef.current - displayedTotalRef.current
      }

      if (pendingDeltaRef.current !== 0) {
        startBadgeCycle()
      }
    }, BADGE_TOTAL_DURATION_MS)
  }

  useEffect(() => {
    cancelBadgeCycle()
    pendingDeltaRef.current = 0
    displayedTotalRef.current = initialTimelineTotal
    observedTotalRef.current = initialTimelineTotal
    setDisplayedTotal(initialTimelineTotal)
  }, [initialTimelineTotal])

  useEffect(() => {
    const delta = targetTotal - observedTotalRef.current
    observedTotalRef.current = targetTotal

    if (delta === 0) {
      return
    }

    pendingDeltaRef.current += delta

    if (pendingDeltaRef.current === 0) {
      cancelBadgeCycle()
      return
    }

    if (isBadgeAnimatingRef.current) {
      setBadge((currentBadge) =>
        currentBadge
          ? {
              ...currentBadge,
              delta: pendingDeltaRef.current,
            }
          : currentBadge,
      )
      return
    }

    startBadgeCycle()
  }, [targetTotal])

  useEffect(() => {
    return () => {
      clearBadgeTimeout()
    }
  }, [])

  const floatingStyle = getFloatingCounterPosition(stageBounds)
  const content = (
    <div
      style={floatingStyle}
      className="pointer-events-none fixed z-20"
    >
      <div className="relative">
        <motion.div
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={springSoft}
          className="relative overflow-hidden rounded-[22px] border border-emerald-300/16 bg-[linear-gradient(180deg,rgba(2,6,23,0.88),rgba(2,6,23,0.76))] px-4 py-3 shadow-[0_20px_60px_rgba(2,6,23,0.34),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.18),transparent_42%),linear-gradient(90deg,rgba(45,212,191,0.08),transparent_55%)]" />

          <div className="relative flex items-center gap-2.5">
            <span className="font-mono text-[13px] text-emerald-100/55">[</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-slate-400">
              Lines
            </span>
            <span className="grid min-w-[6.25rem] justify-items-end">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={displayedTotal}
                  initial={
                    shouldReduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0.7, y: 5, scale: 0.96 }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={
                    shouldReduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, y: -4, scale: 1.03 }
                  }
                  transition={{
                    ...springSoft,
                    opacity: { duration: shouldReduceMotion ? 0.12 : 0.18 },
                  }}
                  className="font-mono text-[20px] font-semibold tracking-[-0.05em] text-emerald-50 tabular-nums"
                >
                  {formatNumber(displayedTotal)}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className="font-mono text-[13px] text-emerald-100/55">]</span>
          </div>
        </motion.div>

        <AnimatePresence initial={false}>
          {badge && badge.delta !== 0 ? (
            <motion.div
              key={badge.id}
              initial={
                shouldReduceMotion
                  ? { opacity: 0, scale: 0.92 }
                  : { opacity: 0, scale: 0.88, x: 0 }
              }
              animate={
                shouldReduceMotion
                  ? {
                      opacity: [0, 1, 1, 0],
                      scale: [0.92, 1, 1, 0.96],
                    }
                  : {
                      opacity: [0, 1, 1, 0],
                      scale: [0.88, 1, 1, 0.84],
                      x: [0, 0, -84, -112],
                    }
              }
              exit={{ opacity: 0 }}
              transition={{
                duration: BADGE_TOTAL_DURATION_MS / 1000,
                times: [0, 0.16, 0.54, 1],
                ease: 'easeOut',
              }}
              className={`pointer-events-none absolute bottom-0 left-[calc(100%+0.75rem)] top-0 flex items-center rounded-full border px-3 py-1.5 font-mono text-[13px] font-semibold tabular-nums shadow-[0_14px_30px_rgba(2,6,23,0.28)] ${
                badge.delta > 0
                  ? 'border-emerald-300/24 bg-emerald-300/14 text-emerald-50'
                  : 'border-rose-300/24 bg-rose-300/14 text-rose-50'
              }`}
              style={{
                transformOrigin: 'right center',
              }}
            >
              {formatSignedNumber(badge.delta)}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )

  if (typeof document === 'undefined') {
    return content
  }

  return createPortal(content, document.body)
}

function buildCumulativeLineTotals(timeline: RepoDisplayTimelineUnit[]) {
  let runningTotal = 0

  return timeline.map((unit) => {
    runningTotal = Math.max(0, runningTotal + getTimelineUnitNetLineDelta(unit))
    return runningTotal
  })
}

function getTimelineUnitNetLineDelta(unit: RepoDisplayTimelineUnit) {
  if (unit.beforeLineCount !== null && unit.afterLineCount !== null) {
    return unit.afterLineCount - unit.beforeLineCount
  }

  if (unit.beforeLineCount === null && unit.afterLineCount !== null) {
    return unit.afterLineCount
  }

  if (unit.beforeLineCount !== null && unit.afterLineCount === null) {
    return -unit.beforeLineCount
  }

  return unit.lineDelta
}

function getFloatingCounterPosition(stageBounds: ViewportBounds | null) {
  const viewportInset = 18

  if (!stageBounds) {
    return {
      top: viewportInset,
      left: viewportInset,
      maxWidth: `calc(100vw - ${viewportInset * 2}px)`,
    }
  }

  return {
    top: Math.max(viewportInset, stageBounds.top + 18),
    left: Math.max(viewportInset, stageBounds.left + 18),
    maxWidth: `min(22rem, calc(100vw - ${viewportInset * 2}px))`,
  }
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatSignedNumber(value: number) {
  const absoluteValue = formatNumber(Math.abs(value))
  return `${value >= 0 ? '+' : '-'}${absoluteValue}`
}
