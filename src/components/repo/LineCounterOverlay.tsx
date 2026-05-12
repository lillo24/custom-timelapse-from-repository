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

export type LineCounterOverlayVersion = 1 | 2

type LineCounterOverlayProps = {
  timeline: RepoDisplayTimelineUnit[]
  activeUnitIndex: number
  isPlaying: boolean
  playbackSpeed: number
  shouldReduceMotion: boolean
  stageBounds: ViewportBounds | null
  version: LineCounterOverlayVersion
  onVersionChange: (version: LineCounterOverlayVersion) => void
}

type CounterBadgeState = {
  id: number
  delta: number
}

type LineChangeIncrement = {
  addedLines: number
  deletedLines: number
}

type LineChangeTotals = {
  addedTotal: number
  deletedTotal: number
}

type SlotRollDirection = 'up' | 'down'

type SlotNumberCharacter =
  | {
      type: 'digit'
      value: string
      placeFromRight: number
    }
  | {
      type: 'separator'
      value: string
      key: string
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
const SLOT_DIGIT_STAGGER_MS = 35
const SLOT_CHARACTER_WIDTH_EM = 0.72
const SLOT_DIGIT_HEIGHT_CLASS = 'h-[2.5em]'
const ZERO_LINE_CHANGE_TOTALS: LineChangeTotals = {
  addedTotal: 0,
  deletedTotal: 0,
}
const ZERO_LINE_CHANGE_INCREMENT: LineChangeIncrement = {
  addedLines: 0,
  deletedLines: 0,
}

export function LineCounterOverlay({
  timeline,
  activeUnitIndex,
  isPlaying,
  playbackSpeed,
  shouldReduceMotion,
  stageBounds,
  version,
  onVersionChange,
}: LineCounterOverlayProps) {
  const cumulativeLineTotals = useMemo(() => buildCumulativeLineTotals(timeline), [timeline])
  const cumulativeLineChangeTotals = useMemo(
    () => buildCumulativeLineChangeTotals(timeline),
    [timeline],
  )
  const clampedActiveUnitIndex =
    timeline.length > 0 ? clampNumber(activeUnitIndex, 0, timeline.length - 1) : -1
  const targetTotal =
    clampedActiveUnitIndex >= 0 ? cumulativeLineTotals[clampedActiveUnitIndex] ?? 0 : 0
  const clampedTimelinePosition =
    timeline.length > 0 ? clampNumber(activeUnitIndex, 0, timeline.length) : 0
  const v2LineTotals =
    cumulativeLineChangeTotals[clampedTimelinePosition] ?? ZERO_LINE_CHANGE_TOTALS
  const finalV2LineTotals =
    cumulativeLineChangeTotals[timeline.length] ?? ZERO_LINE_CHANGE_TOTALS
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
      <div className="flex flex-col items-center gap-2">
        <div className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/82 p-1 shadow-[0_12px_28px_rgba(2,6,23,0.34)] backdrop-blur-md">
          {[1, 2].map((option) => {
            const isActive = version === option

            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onVersionChange(option as LineCounterOverlayVersion)
                }}
                aria-pressed={isActive}
                aria-label={`Switch repo line counter to version ${option}`}
                className={`min-w-8 rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums transition ${
                  isActive
                    ? 'bg-emerald-300/18 text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {option}
              </button>
            )
          })}
        </div>

        <div className="relative">
          {version === 1 ? (
            <motion.div
              initial={
                shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }
              }
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
          ) : (
            <motion.div
              initial={
                shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={springSoft}
              className="relative min-w-[15rem] overflow-hidden rounded-[22px] border border-slate-700/70 bg-[linear-gradient(180deg,rgba(2,6,23,0.9),rgba(2,6,23,0.8))] px-4 py-3 shadow-[0_20px_60px_rgba(2,6,23,0.34),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.14),transparent_46%),linear-gradient(90deg,rgba(148,163,184,0.08),transparent_55%)]" />

              <LineCounterV2
                addedTotal={v2LineTotals.addedTotal}
                deletedTotal={v2LineTotals.deletedTotal}
                maxAddedTotal={finalV2LineTotals.addedTotal}
                maxDeletedTotal={finalV2LineTotals.deletedTotal}
                shouldReduceMotion={shouldReduceMotion}
              />
            </motion.div>
          )}

          <AnimatePresence initial={false}>
            {version === 1 && badge && badge.delta !== 0 ? (
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
    </div>
  )

  if (typeof document === 'undefined') {
    return content
  }

  return createPortal(content, document.body)
}

function LineCounterV2({
  addedTotal,
  deletedTotal,
  maxAddedTotal,
  maxDeletedTotal,
  shouldReduceMotion,
}: {
  addedTotal: number
  deletedTotal: number
  maxAddedTotal: number
  maxDeletedTotal: number
  shouldReduceMotion: boolean
}) {
  return (
    <div className="relative font-mono tabular-nums">
      <div className="mb-2 text-center text-[10px] uppercase tracking-[0.28em] text-slate-400">
        Lines
      </div>

      <div className="flex items-center justify-center gap-4">
        <LineCounterV2Row
          sign="+"
          value={addedTotal}
          maxValue={maxAddedTotal}
          direction="up"
          ariaLabel="Added lines"
          className="text-emerald-300 drop-shadow-[0_0_14px_rgba(110,231,183,0.42)]"
          shouldReduceMotion={shouldReduceMotion}
        />
        <LineCounterV2Row
          sign="-"
          value={deletedTotal}
          maxValue={maxDeletedTotal}
          direction="down"
          ariaLabel="Deleted lines"
          className="text-red-300 drop-shadow-[0_0_14px_rgba(252,165,165,0.42)]"
          shouldReduceMotion={shouldReduceMotion}
        />
      </div>
    </div>
  )
}

function LineCounterV2Row({
  sign,
  value,
  maxValue,
  direction,
  ariaLabel,
  className,
  shouldReduceMotion,
}: {
  sign: string
  value: number
  maxValue: number
  direction: SlotRollDirection
  ariaLabel: string
  className: string
  shouldReduceMotion: boolean
}) {
  return (
    <div
      aria-label={`${ariaLabel}: ${formatNumber(value)}`}
      className={`flex items-center justify-end gap-1.5 text-[18px] leading-none ${className}`}
    >
      <span className="w-3 text-right font-normal">{sign}</span>
      <SlotNumber
        value={value}
        maxValue={maxValue}
        direction={direction}
        shouldReduceMotion={shouldReduceMotion}
      />
    </div>
  )
}

function SlotNumber({
  value,
  maxValue,
  direction,
  shouldReduceMotion,
}: {
  value: number
  maxValue: number
  direction: SlotRollDirection
  shouldReduceMotion: boolean
}) {
  const characters = getSlotNumberCharacters(value)
  const minCharacterCount = Math.max(
    getSlotNumberCharacters(maxValue).length,
    characters.length,
    1,
  )

  return (
    <span
      className="inline-flex justify-end overflow-visible text-right font-normal tracking-[-0.05em]"
      style={{
        minWidth: `${minCharacterCount * SLOT_CHARACTER_WIDTH_EM}em`,
      }}
    >
      {characters.map((character) =>
        character.type === 'digit' ? (
          <SlotDigit
            key={`digit-${character.placeFromRight}`}
            digit={character.value}
            direction={direction}
            delayMs={character.placeFromRight * SLOT_DIGIT_STAGGER_MS}
            shouldReduceMotion={shouldReduceMotion}
          />
        ) : (
          <span
            key={character.key}
            className={`inline-flex ${SLOT_DIGIT_HEIGHT_CLASS} w-[0.32em] items-center justify-center text-current/70`}
          >
            {character.value}
          </span>
        ),
      )}
    </span>
  )
}

function SlotDigit({
  digit,
  direction,
  delayMs,
  shouldReduceMotion,
}: {
  digit: string
  direction: SlotRollDirection
  delayMs: number
  shouldReduceMotion: boolean
}) {
  if (shouldReduceMotion) {
    return (
      <span
        className={`inline-flex ${SLOT_DIGIT_HEIGHT_CLASS} w-[0.68em] items-center justify-center`}
      >
        {digit}
      </span>
    )
  }

  const initialY = direction === 'up' ? '100%' : '-100%'
  const exitY = direction === 'up' ? '-100%' : '100%'

  return (
    <span
      className={`relative inline-block ${SLOT_DIGIT_HEIGHT_CLASS} w-[0.68em] overflow-hidden`}
    >
      <AnimatePresence initial={false}>
        <motion.span
          key={digit}
          initial={{ opacity: 0.75, y: initialY }}
          animate={{ opacity: 1, y: '0%' }}
          exit={{ opacity: 0.75, y: exitY }}
          transition={{
            duration: 0.18,
            delay: delayMs / 1000,
            ease: 'easeOut',
          }}
          className="absolute inset-0 inline-flex items-center justify-center"
        >
          {digit}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

function buildCumulativeLineTotals(timeline: RepoDisplayTimelineUnit[]) {
  let runningTotal = 0

  return timeline.map((unit) => {
    runningTotal = Math.max(0, runningTotal + getTimelineUnitNetLineDelta(unit))
    return runningTotal
  })
}

function buildCumulativeLineChangeTotals(
  timeline: RepoDisplayTimelineUnit[],
): LineChangeTotals[] {
  const lineChanges = buildTimelineLineChangeIncrements(timeline)
  const cumulativeTotals: LineChangeTotals[] = [ZERO_LINE_CHANGE_TOTALS]
  let addedTotal = 0
  let deletedTotal = 0

  for (const change of lineChanges) {
    addedTotal += change.addedLines
    deletedTotal += change.deletedLines
    cumulativeTotals.push({
      addedTotal,
      deletedTotal,
    })
  }

  return cumulativeTotals
}

function buildTimelineLineChangeIncrements(
  timeline: RepoDisplayTimelineUnit[],
): LineChangeIncrement[] {
  const lineChanges = timeline.map(() => ZERO_LINE_CHANGE_INCREMENT)
  let groupStartIndex = 0

  while (groupStartIndex < timeline.length) {
    const groupEndIndex = findTimelineUnitGroupEnd(timeline, groupStartIndex)
    const group = timeline.slice(groupStartIndex, groupEndIndex)
    const exactLineChanges = group
      .map((unit, groupOffset) => ({
        index: groupStartIndex + groupOffset,
        change: getExactTimelineUnitLineChange(unit),
      }))
      .filter(
        (entry): entry is { index: number; change: LineChangeIncrement } =>
          entry.change !== null,
      )

    if (exactLineChanges.length > 0) {
      for (const { index, change } of exactLineChanges) {
        lineChanges[index] = change
      }
    } else {
      // Older display models repeat file-level deltas on split units; count once per contiguous file-change group.
      lineChanges[groupStartIndex] = getFallbackTimelineGroupLineChange(group[0])
    }

    groupStartIndex = groupEndIndex
  }

  return lineChanges
}

function getExactTimelineUnitLineChange(
  unit: RepoDisplayTimelineUnit,
): LineChangeIncrement | null {
  const unitLineAmount = normalizeUnitLineAmount(unit.unitLineAmount)

  if (unitLineAmount === null) {
    return null
  }

  if (unit.type === 'grow') {
    return {
      addedLines: unitLineAmount,
      deletedLines: 0,
    }
  }

  if (unit.type === 'shrink') {
    return {
      addedLines: 0,
      deletedLines: unitLineAmount,
    }
  }

  return null
}

function getFallbackTimelineGroupLineChange(
  unit: RepoDisplayTimelineUnit | undefined,
): LineChangeIncrement {
  if (!unit) {
    return ZERO_LINE_CHANGE_INCREMENT
  }

  const delta = getTimelineUnitNetLineDelta(unit)

  if (delta > 0) {
    return {
      addedLines: delta,
      deletedLines: 0,
    }
  }

  if (delta < 0) {
    return {
      addedLines: 0,
      deletedLines: Math.abs(delta),
    }
  }

  return ZERO_LINE_CHANGE_INCREMENT
}

function findTimelineUnitGroupEnd(
  timeline: RepoDisplayTimelineUnit[],
  groupStartIndex: number,
) {
  const firstUnit = timeline[groupStartIndex]

  if (!firstUnit) {
    return groupStartIndex
  }

  const groupKey = getTimelineUnitGroupKey(firstUnit)
  let groupEndIndex = groupStartIndex + 1

  while (
    groupEndIndex < timeline.length &&
    getTimelineUnitGroupKey(timeline[groupEndIndex]) === groupKey
  ) {
    groupEndIndex += 1
  }

  return groupEndIndex
}

function getTimelineUnitGroupKey(unit: RepoDisplayTimelineUnit) {
  return [
    unit.sourceFileId,
    unit.sourceFilePath,
    unit.displayNodeId,
    unit.lineDelta,
    unit.beforeLineCount ?? 'null',
    unit.afterLineCount ?? 'null',
  ].join('\u0000')
}

function normalizeUnitLineAmount(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null
  }

  return Math.round(value)
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

function getSlotNumberCharacters(value: number): SlotNumberCharacter[] {
  const formattedValue = formatNumber(Math.max(0, Math.round(value)))
  const formattedCharacters = formattedValue.split('')
  let remainingDigits = formattedCharacters.filter(isDigitCharacter).length

  return formattedCharacters.map((character, index) => {
    if (!isDigitCharacter(character)) {
      return {
        type: 'separator',
        value: character,
        key: `separator-${index}-${character}`,
      }
    }

    remainingDigits -= 1

    return {
      type: 'digit',
      value: character,
      placeFromRight: remainingDigits,
    }
  })
}

function isDigitCharacter(value: string) {
  return value >= '0' && value <= '9'
}
