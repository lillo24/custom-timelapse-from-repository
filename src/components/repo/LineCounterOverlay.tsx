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
  isPlaying: boolean
  playbackSpeed: number
  shouldReduceMotion: boolean
  stageBounds: ViewportBounds | null
}

type CounterBadgeState = {
  id: number
  delta: number
}

const LINE_COUNTER_SETTINGS = {
  topOffsetPx: 40, //How far the counter is from the top. Bigger = lower on screen.
  minBadgeIntervalMs: 500, //Minimum time between visible +N / -N badge events. Prevents spam.
  badgeAppearMs: 500, //How long the badge takes to appear.
  badgeHoldMs: 700, //How long the badge stays readable before merging.
  badgeMergeMs: 450, //How long the slide-left merge animation takes.
  minAbsDeltaForImmediateBadge: 20, //If the accumulated line delta reaches at least 20, show a badge immediately instead of waiting.
} as const

const BADGE_TOTAL_DURATION_MS =
  LINE_COUNTER_SETTINGS.badgeAppearMs +
  LINE_COUNTER_SETTINGS.badgeHoldMs +
  LINE_COUNTER_SETTINGS.badgeMergeMs
const BADGE_APPEAR_END =
  LINE_COUNTER_SETTINGS.badgeAppearMs / BADGE_TOTAL_DURATION_MS
const BADGE_HOLD_END =
  (LINE_COUNTER_SETTINGS.badgeAppearMs + LINE_COUNTER_SETTINGS.badgeHoldMs) /
  BADGE_TOTAL_DURATION_MS

export function LineCounterOverlay({
  timeline,
  activeUnitIndex,
  isPlaying,
  playbackSpeed,
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
  const previousActiveUnitIndexRef = useRef(activeUnitIndex)
  const pendingDeltaRef = useRef(0)
  const badgeIdRef = useRef(0)
  const startTimeoutRef = useRef<number | null>(null)
  const mergeTimeoutRef = useRef<number | null>(null)
  const pendingWindowStartedAtRef = useRef<number | null>(null)
  const currentBadgeDeltaRef = useRef(0)
  const isPlayingRef = useRef(isPlaying)
  const playbackSpeedRef = useRef(playbackSpeed)
  const isBadgeAnimatingRef = useRef(false)

  const clearStartTimeout = () => {
    if (startTimeoutRef.current !== null) {
      window.clearTimeout(startTimeoutRef.current)
      startTimeoutRef.current = null
    }
  }

  const clearBadgeTimeout = () => {
    if (mergeTimeoutRef.current !== null) {
      window.clearTimeout(mergeTimeoutRef.current)
      mergeTimeoutRef.current = null
    }
  }

  const cancelBadgeCycle = () => {
    clearStartTimeout()
    clearBadgeTimeout()
    currentBadgeDeltaRef.current = 0
    pendingWindowStartedAtRef.current = null
    isBadgeAnimatingRef.current = false
    setBadge(null)
  }

  const startBadgeCycle = () => {
    if (pendingDeltaRef.current === 0) {
      return
    }

    clearStartTimeout()
    const badgeDelta = pendingDeltaRef.current
    pendingDeltaRef.current = 0
    pendingWindowStartedAtRef.current = null
    currentBadgeDeltaRef.current = badgeDelta
    isBadgeAnimatingRef.current = true
    badgeIdRef.current += 1
    setBadge({
      id: badgeIdRef.current,
      delta: badgeDelta,
    })

    mergeTimeoutRef.current = window.setTimeout(() => {
      const mergeDelta = currentBadgeDeltaRef.current

      if (mergeDelta !== 0) {
        const nextDisplayedTotal = Math.max(0, displayedTotalRef.current + mergeDelta)
        displayedTotalRef.current = nextDisplayedTotal
        setDisplayedTotal(nextDisplayedTotal)
      }

      currentBadgeDeltaRef.current = 0
      setBadge(null)
      isBadgeAnimatingRef.current = false
      mergeTimeoutRef.current = null

      if (pendingDeltaRef.current !== 0) {
        scheduleBadgeStart()
      }
    }, BADGE_TOTAL_DURATION_MS)
  }

  const scheduleBadgeStart = () => {
    if (pendingDeltaRef.current === 0 || isBadgeAnimatingRef.current) {
      clearStartTimeout()
      return
    }

    clearStartTimeout()

    const now = Date.now()

    if (pendingWindowStartedAtRef.current === null) {
      pendingWindowStartedAtRef.current = now
    }

    const isCurrentlyPlaying = isPlayingRef.current
    const effectiveMinIntervalMs = isCurrentlyPlaying
      ? getEffectiveBadgeIntervalMs(playbackSpeedRef.current)
      : 0
    const immediateThreshold = getImmediateBadgeThreshold(
      playbackSpeedRef.current,
      isCurrentlyPlaying,
    )

    if (
      effectiveMinIntervalMs === 0 ||
      Math.abs(pendingDeltaRef.current) >= immediateThreshold
    ) {
      startBadgeCycle()
      return
    }

    const elapsedMs = now - pendingWindowStartedAtRef.current
    const remainingMs = Math.max(0, effectiveMinIntervalMs - elapsedMs)

    startTimeoutRef.current = window.setTimeout(() => {
      startTimeoutRef.current = null

      if (!isBadgeAnimatingRef.current && pendingDeltaRef.current !== 0) {
        startBadgeCycle()
      }
    }, remainingMs)
  }

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed
  }, [playbackSpeed])

  useEffect(() => {
    cancelBadgeCycle()
    pendingDeltaRef.current = 0
    displayedTotalRef.current = initialTimelineTotal
    observedTotalRef.current = initialTimelineTotal
    previousActiveUnitIndexRef.current = activeUnitIndex
    setDisplayedTotal(initialTimelineTotal)
  }, [initialTimelineTotal])

  useEffect(() => {
    const previousActiveUnitIndex = previousActiveUnitIndexRef.current
    previousActiveUnitIndexRef.current = activeUnitIndex
    const didWrapFromRestFrameToStart =
      timeline.length > 0 &&
      previousActiveUnitIndex === timeline.length &&
      activeUnitIndex === 0

    if (didWrapFromRestFrameToStart) {
      cancelBadgeCycle()
      pendingDeltaRef.current = 0
      displayedTotalRef.current = targetTotal
      observedTotalRef.current = targetTotal
      setDisplayedTotal(targetTotal)
      return
    }

    const delta = targetTotal - observedTotalRef.current
    observedTotalRef.current = targetTotal

    if (delta === 0) {
      return
    }

    pendingDeltaRef.current += delta

    if (pendingDeltaRef.current === 0) {
      clearStartTimeout()
      pendingWindowStartedAtRef.current = null
      return
    }

    scheduleBadgeStart()
  }, [activeUnitIndex, targetTotal, timeline.length])

  useEffect(() => {
    if (pendingDeltaRef.current !== 0 && !isBadgeAnimatingRef.current) {
      scheduleBadgeStart()
    }
  }, [isPlaying, playbackSpeed])

  useEffect(() => {
    return () => {
      clearStartTimeout()
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
                      scale: [0.92, 1, 1, 0.94],
                    }
                  : {
                      opacity: [0, 1, 1, 0],
                      scale: [0.88, 1, 1, 0.82],
                      x: [0, 0, -96, -132],
                    }
              }
              exit={{ opacity: 0 }}
              transition={{
                duration: BADGE_TOTAL_DURATION_MS / 1000,
                times: [0, BADGE_APPEAR_END, BADGE_HOLD_END, 1],
                ease: 'easeOut',
              }}
              className={`pointer-events-none absolute bottom-0 left-[calc(100%+0.8rem)] top-0 flex items-center rounded-full border px-3 py-1.5 font-mono text-[16px] font-semibold tabular-nums shadow-[0_16px_32px_rgba(2,6,23,0.28)] ${
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
      left: '50%',
      transform: 'translateX(-50%)',
      maxWidth: `calc(100vw - ${viewportInset * 2}px)`,
    }
  }

  return {
    top: Math.max(viewportInset, stageBounds.top + LINE_COUNTER_SETTINGS.topOffsetPx),
    left: stageBounds.left + stageBounds.width / 2,
    transform: 'translateX(-50%)',
    maxWidth: `min(22rem, calc(100vw - ${viewportInset * 2}px))`,
  }
}

function getEffectiveBadgeIntervalMs(playbackSpeed: number) {
  const speedFactor =
    playbackSpeed >= 4 ? 1.6 : playbackSpeed >= 2 ? 1.25 : playbackSpeed < 1 ? 0.9 : 1

  return Math.round(LINE_COUNTER_SETTINGS.minBadgeIntervalMs * speedFactor)
}

function getImmediateBadgeThreshold(playbackSpeed: number, isPlaying: boolean) {
  if (!isPlaying) {
    return LINE_COUNTER_SETTINGS.minAbsDeltaForImmediateBadge
  }

  const speedFactor = clampNumber(1 + Math.max(playbackSpeed - 1, 0) * 0.35, 1, 2)
  return Math.round(LINE_COUNTER_SETTINGS.minAbsDeltaForImmediateBadge * speedFactor)
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
