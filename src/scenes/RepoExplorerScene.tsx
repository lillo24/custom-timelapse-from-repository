import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  startTransition,
  type CSSProperties,
  useEffect,
  useEffectEvent,
  useMemo,
  type RefObject,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { LineCounterOverlay } from '../components/repo/LineCounterOverlay'
import { PresentationStage } from '../components/presentation/PresentationStage'
import {
  LIVE_REPO_DISPLAY_MODEL_URL,
  useRepoDisplayModel,
} from '../hooks/useRepoDisplayModel'
import {
  getFadeSlideSide,
  getFadeSlideUp,
  getScaleFade,
  getStaggerDelay,
  springSoft,
} from '../lib/motionPresets'
import type {
  RepoDisplayModel,
  RepoDisplayNode,
  RepoDisplayNodeType,
  RepoDisplaySizeTrackingStyle,
  RepoDisplayTimelineUnit,
  RepoDisplayVisibilityFrame,
} from '../preprocessing/displayModelTypes'

type RepoVisualSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type PlaybackSpeed = (typeof PLAYBACK_SPEED_OPTIONS)[number]
type PlaybackDurationSeconds = (typeof PLAYBACK_DURATION_OPTIONS)[number]
type FloatingPlaybackLayout = 'vertical' | 'horizontal'

type ViewportBounds = {
  top: number
  right: number
  bottom: number
  left: number
  width: number
  height: number
}

type SourceFileReplayState = {
  exists: boolean
  currentLineCount: number
}

type CurrentRepoNodeState = {
  exists: boolean
  currentLineCount: number
  maxLineCount: number
  finalLineCount: number
  recentlyChanged: boolean
}

type RepoDisplayNodeCountOverrides = {
  childCount: number
  visibleChildCount: number
  hiddenChildCount: number
  hiddenDescendantCount: number
}

type RepoNodeSizeTrackingState = {
  enabled: boolean
  ratio: number
  growthIntensity: number
  maxVisualPercent: number
  visualPercentRatio: number
  normalizationMaxLines: number
  rowHeightRem: number
  fontSizeRem: number
}

type RepoNodeActivityFireState = {
  heatScore: number
  recentHits: number
  fireTier: 0 | 1 | 2 | 3
}

type RepoExplorerFireTuningState = {
  fireWindowSize: number
  tier1Threshold: number
  tier2Threshold: number
  tier3Threshold: number
  fireSizePx: number
}

type RepoExplorerTuningState = {
  sizeTrackingStyle: RepoDisplaySizeTrackingStyle
  fireTuning: RepoExplorerFireTuningState
  maxVisualPercentByNodePath: Record<string, number>
}

type RepoExplorerTuningStoragePayload = {
  sizeTrackingStyle?: Partial<RepoDisplaySizeTrackingStyle>
  fireTuning?: Partial<RepoExplorerFireTuningState>
  sizeTrackedNodes?: Record<string, { maxVisualPercent?: number }>
}

type TrackedRepoNodeTuningControl = {
  path: string
  label: string
  defaultMaxVisualPercent: number
}

type VisibleRepoNode = {
  node: RepoDisplayNode
  state: CurrentRepoNodeState
  currentVisualScale: number
  currentVisualSize: RepoVisualSize
  currentVisualWeight: number
  persistentVisualWeight: number
  highlightStrength: number
  sizeTracking: RepoNodeSizeTrackingState | null
  activityFire: RepoNodeActivityFireState | null
}

type FeaturedSection = {
  id: string
  title: string
  path: string
  kindLabel: string
  nodes: VisibleRepoNode[]
  totalVisualWeight: number
  visibleNodeCount: number
}

type RepoProgressState = {
  activeUnit: RepoDisplayTimelineUnit | null
  visibleNodes: VisibleRepoNode[]
  recentTouchedCount: number
}

type RepoExplorerFireDebugState = {
  nodePath: string
  nodeLabel: string
  heatScore: number
  recentHits: number
  fireTier: 0 | 1 | 2 | 3
}

type ExplorerRow = {
  id: string
  label: string
  path: string
  depth: number
  type: RepoDisplayNodeType
  hiddenChildCount: number
  hiddenDescendantCount: number
  recentlyChanged: boolean
  ancestorHasNextSibling: boolean[]
  hasNextSibling: boolean
  sizeTracking: RepoNodeSizeTrackingState | null
  activityFire: RepoNodeActivityFireState | null
}

type RepoProgressCache = {
  model: RepoDisplayModel
  activeUnitIndex: number
  sourceFileStateById: Map<string, SourceFileReplayState>
}

const PLAYBACK_DURATION_OPTIONS = [15, 30, 45, 60] as const
const PLAYBACK_SPEED_OPTIONS = [0.5, 1, 2, 4] as const
const RECENT_UNIT_WINDOW = 20
const REPO_EXPLORER_V2_TUNING_STORAGE_KEY = 'repoExplorerV2Tuning'
// 0.8125rem = 13px at the browser-default 16px root font size.
const NORMAL_EXPLORER_FONT_REM = 0.8125
const FIRE_GIF_ASSET_URL = '/assets/fire.gif'
const DEFAULT_FIRE_WINDOW_SIZE = 36
const DEFAULT_FIRE_TIER_ONE_THRESHOLD = 0.08
const DEFAULT_FIRE_TIER_TWO_THRESHOLD = 0.2
const DEFAULT_FIRE_TIER_THREE_THRESHOLD = 0.38
const DEFAULT_FIRE_SIZE_PX = 18
const FIRE_HEAT_DAMPING_MULTIPLIER = 1.5
const SIDEBAR_TREE_INDENT = 14
const FEATURED_SECTION_LIMIT = 4
const SECTION_CARD_LIMIT = 8
const SUBTLE_SCROLLBAR_CLASS =
  '[scrollbar-width:thin] [scrollbar-color:rgba(51,65,85,0.55)_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700/45 [&::-webkit-scrollbar-thumb:hover]:bg-slate-600/55'

const NODE_TYPE_STYLES: Record<
  RepoDisplayNodeType,
  {
    badge: string
    glow: string
    label: string
  }
> = {
  folder: {
    badge:
      'border-cyan-400/25 bg-cyan-400/12 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.04)]',
    glow: 'from-cyan-300/45 via-cyan-400/12 to-transparent',
    label: 'Folder',
  },
  file: {
    badge:
      'border-emerald-400/25 bg-emerald-400/12 text-emerald-100 shadow-[0_0_0_1px_rgba(16,185,129,0.04)]',
    glow: 'from-emerald-300/45 via-emerald-400/12 to-transparent',
    label: 'File',
  },
  collapsedFolder: {
    badge:
      'border-amber-400/25 bg-amber-400/12 text-amber-100 shadow-[0_0_0_1px_rgba(245,158,11,0.04)]',
    glow: 'from-amber-300/45 via-amber-400/12 to-transparent',
    label: 'Collapsed',
  },
}

const FILE_SIZE_LAYOUT: Record<
  RepoVisualSize,
  {
    span: string
    baseMinHeight: number
  }
> = {
  xs: {
    span: 'col-span-2 lg:col-span-1',
    baseMinHeight: 76,
  },
  sm: {
    span: 'col-span-2',
    baseMinHeight: 92,
  },
  md: {
    span: 'col-span-3',
    baseMinHeight: 114,
  },
  lg: {
    span: 'col-span-3 xl:col-span-4',
    baseMinHeight: 136,
  },
  xl: {
    span: 'col-span-4',
    baseMinHeight: 158,
  },
}

const SIZE_LABELS: Record<RepoVisualSize, string> = {
  xs: 'Pocket',
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
  xl: 'Anchor',
}

const VISUAL_SIZE_ORDER: RepoVisualSize[] = ['xs', 'sm', 'md', 'lg', 'xl']

const VISUAL_SIZE_RANK: Record<RepoVisualSize, number> = {
  xs: 0,
  sm: 1,
  md: 2,
  lg: 3,
  xl: 4,
}

const SIZE_TRACKING_STYLE_RANGES = {
  baseRowHeightRem: { min: 0.8, max: 2, step: 0.05 },
  maxExtraHeightRem: { min: 0, max: 4, step: 0.05 },
  baseFontSizeRem: { min: 0.55, max: 1.2, step: 0.05 },
  maxExtraFontSizeRem: { min: 0, max: 0.8, step: 0.05 },
} as const

const MAX_VISUAL_PERCENT_RANGE = {
  min: 0,
  max: 200,
  step: 5,
} as const

const FIRE_TUNING_RANGES = {
  fireWindowSize: { min: 12, max: 72, step: 1 },
  tier1Threshold: { min: 0, max: 0.5, step: 0.01 },
  tier2Threshold: { min: 0.02, max: 0.75, step: 0.01 },
  tier3Threshold: { min: 0.04, max: 1, step: 0.01 },
  fireSizePx: { min: 12, max: 28, step: 1 },
} as const

type RepoExplorerSceneProps = {
  modelUrl?: string
  snapshotLabel?: string
  enableTuningPanel?: boolean
  enableActivityFireIndicators?: boolean
}

export function RepoExplorerScene({
  modelUrl = LIVE_REPO_DISPLAY_MODEL_URL,
  snapshotLabel,
  enableTuningPanel = false,
  enableActivityFireIndicators = false,
}: RepoExplorerSceneProps) {
  const shouldReduceMotion = useReducedMotion() ?? false
  const overlayMotion = getFadeSlideUp(shouldReduceMotion, 10)
  const { model, error, isLoading } = useRepoDisplayModel(modelUrl)
  const stageRef = useRef<HTMLElement | null>(null)
  const stageBounds = useElementViewportBounds(stageRef)

  return (
    <main className="flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.14),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.12),transparent_28%),linear-gradient(180deg,#020617_0%,#02030a_100%)] p-4 text-slate-50 sm:p-5 lg:p-6">
      <div className="flex h-full w-full items-center justify-center">
        <PresentationStage ref={stageRef}>
          <div className="relative h-full overflow-hidden bg-[linear-gradient(160deg,rgba(8,15,32,0.98),rgba(3,7,18,0.98))]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.1),transparent_28%),radial-gradient(circle_at_82%_16%,rgba(251,191,36,0.08),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_30%)]" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            {snapshotLabel ? (
              <div className="pointer-events-none absolute left-5 top-5 z-10 sm:left-6 sm:top-6">
                <div className="rounded-full border border-amber-300/20 bg-slate-950/82 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-amber-100/90 shadow-[0_14px_32px_rgba(0,0,0,0.24)] backdrop-blur-md">
                  {snapshotLabel}
                </div>
              </div>
            ) : null}

            <motion.div
              initial={overlayMotion.initial}
              animate={overlayMotion.animate}
              transition={springSoft}
              className="relative flex h-full flex-col gap-4 p-5 sm:p-6"
            >
              {isLoading ? (
                <RepoExplorerSkeleton />
              ) : error ? (
                <RepoExplorerError
                  message={error}
                  modelUrl={modelUrl}
                />
              ) : model ? (
                <RepoExplorerCanvas
                  model={model}
                  shouldReduceMotion={shouldReduceMotion}
                  stageBounds={stageBounds}
                  enableTuningPanel={enableTuningPanel}
                  enableActivityFireIndicators={enableActivityFireIndicators}
                />
              ) : (
                <RepoExplorerError
                  message="Repository display model did not load."
                  modelUrl={modelUrl}
                />
              )}
            </motion.div>
          </div>
        </PresentationStage>
      </div>
    </main>
  )
}

function RepoExplorerCanvas({
  model,
  shouldReduceMotion,
  stageBounds,
  enableTuningPanel,
  enableActivityFireIndicators,
}: {
  model: RepoDisplayModel
  shouldReduceMotion: boolean
  stageBounds: ViewportBounds | null
  enableTuningPanel: boolean
  enableActivityFireIndicators: boolean
}) {
  const panelMotion = getFadeSlideSide(shouldReduceMotion, 16)
  const sectionPresenceMotion = getFadeSlideUp(shouldReduceMotion, 8)
  const hasTimeline = model.timeline.length > 0
  const maxPlaybackIndex = hasTimeline ? model.timeline.length : 0
  const trackedNodeControls = useMemo(
    () => getTrackedRepoNodeTuningControls(model),
    [model],
  )
  const defaultTuningState = useMemo(
    () => createDefaultRepoExplorerTuningState(model, trackedNodeControls),
    [model, trackedNodeControls],
  )
  const [activeUnitIndex, setActiveUnitIndex] = useState(maxPlaybackIndex)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackDurationSeconds, setPlaybackDurationSeconds] =
    useState<PlaybackDurationSeconds>(30)
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1)
  const [tuningState, setTuningState] = useState<RepoExplorerTuningState | null>(
    null,
  )
  const [tuningStatusMessage, setTuningStatusMessage] = useState<string | null>(
    null,
  )
  const clampedActiveUnitIndex = clampNumber(activeUnitIndex, 0, maxPlaybackIndex)
  const currentUnitIndexRef = useRef(clampedActiveUnitIndex)
  const playbackCarryRef = useRef(0)
  const lastAnimationFrameRef = useRef<number | null>(null)
  const playbackUnitsPerSecond =
    hasTimeline
      ? (model.timeline.length / playbackDurationSeconds) * playbackSpeed
      : 0
  const fullRunDurationSeconds =
    playbackSpeed > 0 ? playbackDurationSeconds / playbackSpeed : 0
  const remainingUnitCount = Math.max(
    0,
    maxPlaybackIndex - clampedActiveUnitIndex,
  )
  const remainingPlaybackSeconds =
    playbackUnitsPerSecond > 0
      ? remainingUnitCount / playbackUnitsPerSecond
      : 0
  const isRestFrame = hasTimeline && clampedActiveUnitIndex === maxPlaybackIndex
  const canTuneLiveScene =
    enableTuningPanel && trackedNodeControls.length > 0
  const effectiveTuningState = canTuneLiveScene
    ? (tuningState ?? defaultTuningState)
    : defaultTuningState
  const effectiveSizeTrackingStyle = effectiveTuningState.sizeTrackingStyle
  const effectiveFireTuning = effectiveTuningState.fireTuning
  const effectiveMaxVisualPercentByNodePath =
    effectiveTuningState.maxVisualPercentByNodePath

  useEffect(() => {
    if (!canTuneLiveScene) {
      setTuningState(null)
      setTuningStatusMessage(null)
      return
    }

    setTuningState(
      loadRepoExplorerTuningState(defaultTuningState, trackedNodeControls),
    )
    setTuningStatusMessage(null)
  }, [canTuneLiveScene, defaultTuningState, trackedNodeControls])

  useEffect(() => {
    if (!canTuneLiveScene || !tuningState || typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(
      REPO_EXPLORER_V2_TUNING_STORAGE_KEY,
      JSON.stringify(serializeRepoExplorerTuningState(tuningState)),
    )
  }, [canTuneLiveScene, tuningState])

  useEffect(() => {
    if (!tuningStatusMessage || typeof window === 'undefined') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setTuningStatusMessage(null)
    }, 2200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [tuningStatusMessage])

  useEffect(() => {
    currentUnitIndexRef.current = clampedActiveUnitIndex
  }, [clampedActiveUnitIndex])

  useEffect(() => {
    if (!hasTimeline && isPlaying) {
      setIsPlaying(false)
    }
  }, [hasTimeline, isPlaying])

  useEffect(() => {
    if (isPlaying && clampedActiveUnitIndex >= maxPlaybackIndex) {
      setIsPlaying(false)
    }
  }, [clampedActiveUnitIndex, isPlaying, maxPlaybackIndex])

  function updateActiveUnitIndex(nextIndex: number) {
    const clampedIndex = clampNumber(nextIndex, 0, maxPlaybackIndex)
    currentUnitIndexRef.current = clampedIndex
    startTransition(() => {
      setActiveUnitIndex(clampedIndex)
    })
  }

  const advancePlaybackFrame = useEffectEvent((timestamp: number) => {
    if (!isPlaying || !hasTimeline) {
      return
    }

    if (lastAnimationFrameRef.current === null) {
      lastAnimationFrameRef.current = timestamp
      return
    }

    const elapsedMs = timestamp - lastAnimationFrameRef.current
    lastAnimationFrameRef.current = timestamp

    const pendingUnits =
      playbackCarryRef.current + (elapsedMs / 1000) * playbackUnitsPerSecond
    const unitsToAdvance = Math.floor(pendingUnits)
    playbackCarryRef.current = pendingUnits - unitsToAdvance

    if (unitsToAdvance < 1) {
      return
    }

    const nextIndex = Math.min(
      maxPlaybackIndex,
      currentUnitIndexRef.current + unitsToAdvance,
    )

    if (nextIndex !== currentUnitIndexRef.current) {
      updateActiveUnitIndex(nextIndex)
    }

    if (nextIndex >= maxPlaybackIndex) {
      playbackCarryRef.current = 0
      lastAnimationFrameRef.current = null
      setIsPlaying(false)
    }
  })

  useEffect(() => {
    if (!isPlaying || !hasTimeline) {
      return
    }

    playbackCarryRef.current = 0
    lastAnimationFrameRef.current = null

    let frameId = 0

    function playbackLoop(timestamp: number) {
      advancePlaybackFrame(timestamp)
      frameId = window.requestAnimationFrame(playbackLoop)
    }

    frameId = window.requestAnimationFrame(playbackLoop)

    return () => {
      window.cancelAnimationFrame(frameId)
      playbackCarryRef.current = 0
      lastAnimationFrameRef.current = null
    }
  }, [
    advancePlaybackFrame,
    hasTimeline,
    isPlaying,
    playbackDurationSeconds,
    playbackSpeed,
  ])

  function handleTogglePlayback() {
    if (!hasTimeline) {
      return
    }

    if (isPlaying) {
      setIsPlaying(false)
      return
    }

    if (clampedActiveUnitIndex >= maxPlaybackIndex) {
      updateActiveUnitIndex(0)
    }

    setIsPlaying(true)
  }

  function updateSizeTrackingStyleValue(
    key: keyof RepoDisplaySizeTrackingStyle,
    nextValue: number,
  ) {
    if (!canTuneLiveScene) {
      return
    }

    setTuningState((current) => {
      const baseState = current ?? defaultTuningState

      return {
        ...baseState,
        sizeTrackingStyle: {
          ...baseState.sizeTrackingStyle,
          [key]: clampSizeTrackingStyleValue(key, nextValue),
        },
      }
    })
  }

  function updateTrackedNodeMaxVisualPercent(path: string, nextValue: number) {
    if (!canTuneLiveScene) {
      return
    }

    setTuningState((current) => {
      const baseState = current ?? defaultTuningState

      return {
        ...baseState,
        maxVisualPercentByNodePath: {
          ...baseState.maxVisualPercentByNodePath,
          [path]: clampTrackedNodeVisualPercent(nextValue),
        },
      }
    })
  }

  function updateFireTuningValue(
    key: keyof RepoExplorerFireTuningState,
    nextValue: number,
  ) {
    if (!canTuneLiveScene) {
      return
    }

    setTuningState((current) => {
      const baseState = current ?? defaultTuningState

      return {
        ...baseState,
        fireTuning: normalizeRepoExplorerFireTuningState({
          ...baseState.fireTuning,
          [key]: nextValue,
        }),
      }
    })
  }

  async function handleCopyTuningConfig() {
    const didCopy = await copyTextToClipboard(
      JSON.stringify(
        buildRepoExplorerTuningConfigSnippet(
          effectiveTuningState,
          trackedNodeControls,
        ),
        null,
        2,
      ),
    )

    setTuningStatusMessage(
      didCopy ? 'Copied config JSON.' : 'Copy failed in this browser.',
    )
  }

  function handleResetTuning() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(REPO_EXPLORER_V2_TUNING_STORAGE_KEY)
    }

    setTuningState(defaultTuningState)
    setTuningStatusMessage('Reset to model values.')
  }

  function handleSetBaseFontToNormal() {
    updateSizeTrackingStyleValue('baseFontSizeRem', NORMAL_EXPLORER_FONT_REM)
    setTuningStatusMessage('Base font set to 13px.')
  }

  const progressState = useRepoProgressState(
    model,
    clampedActiveUnitIndex,
    effectiveSizeTrackingStyle,
    effectiveFireTuning,
    effectiveMaxVisualPercentByNodePath,
    enableActivityFireIndicators,
  )
  const activeUnit = progressState.activeUnit
  const visibleNodes = progressState.visibleNodes
  const hottestActivityFire = useMemo(
    () => getHottestActivityFireState(visibleNodes),
    [visibleNodes],
  )
  const {
    explorerRows,
    featuredSections,
    visibleNodeCount,
    visibleFolderCount,
  } = useMemo(() => {
    return {
      explorerRows: buildExplorerRows(visibleNodes),
      featuredSections: selectFeaturedSections(visibleNodes),
      visibleNodeCount: visibleNodes.length,
      visibleFolderCount: countVisibleFolderNodes(visibleNodes),
    }
  }, [visibleNodes])
  const canStepBackward = model.timeline.length > 0 && clampedActiveUnitIndex > 0
  const canStepForward =
    hasTimeline && clampedActiveUnitIndex < maxPlaybackIndex
  const activeUnitLabel =
    isRestFrame
      ? 'Complete'
      : hasTimeline
      ? `Unit ${formatNumber(clampedActiveUnitIndex + 1)} / ${formatNumber(model.timeline.length)}`
      : 'No timeline units'
  const activeOrderLabel = isRestFrame
    ? 'Rest frame'
    : activeUnit
    ? `Order ${formatNumber(activeUnit.unitOrder)}`
    : 'Static fallback'

  return (
    <>
      <LineCounterOverlay
        timeline={model.timeline}
        activeUnitIndex={clampedActiveUnitIndex}
        isPlaying={isPlaying}
        playbackSpeed={playbackSpeed}
        shouldReduceMotion={shouldReduceMotion}
        stageBounds={stageBounds}
      />

      <FloatingPlaybackControls
        shouldReduceMotion={shouldReduceMotion}
        stageBounds={stageBounds}
        isPlaying={isPlaying}
        canStepBackward={canStepBackward}
        canStepForward={canStepForward}
        hasTimeline={hasTimeline}
        timelineLength={model.timeline.length}
        maxUnitIndex={maxPlaybackIndex}
        activeUnitIndex={clampedActiveUnitIndex}
        activeUnitLabel={activeUnitLabel}
        activeOrderLabel={activeOrderLabel}
        playbackDurationSeconds={playbackDurationSeconds}
        playbackSpeed={playbackSpeed}
        fullRunDurationSeconds={fullRunDurationSeconds}
        remainingPlaybackSeconds={remainingPlaybackSeconds}
        remainingUnitCount={remainingUnitCount}
        visibleNodeCount={visibleNodeCount}
        visibleFolderCount={visibleFolderCount}
        recentTouchedCount={progressState.recentTouchedCount}
        onTogglePlayback={handleTogglePlayback}
        onReset={() => {
          updateActiveUnitIndex(0)
        }}
        onStepBackward={() => {
          updateActiveUnitIndex(clampedActiveUnitIndex - 1)
        }}
        onStepForward={() => {
          updateActiveUnitIndex(clampedActiveUnitIndex + 1)
        }}
        onSelectDuration={(durationSeconds) => {
          setPlaybackDurationSeconds(durationSeconds)
        }}
        onSelectSpeed={(speed) => {
          setPlaybackSpeed(speed)
        }}
        onProgressChange={(nextIndex) => {
          updateActiveUnitIndex(nextIndex)
        }}
      />

      <FloatingModelWarningsPanel
        warnings={model.warnings}
        shouldReduceMotion={shouldReduceMotion}
      />

      {canTuneLiveScene ? (
        <FloatingRepoTuningPanel
          shouldReduceMotion={shouldReduceMotion}
          trackedNodeControls={trackedNodeControls}
          tuningState={effectiveTuningState}
          hottestActivityFire={hottestActivityFire}
          statusMessage={tuningStatusMessage}
          onUpdateStyleValue={updateSizeTrackingStyleValue}
          onUpdateFireTuningValue={updateFireTuningValue}
          onUpdateTrackedNodePercent={updateTrackedNodeMaxVisualPercent}
          onSetBaseFontToNormal={handleSetBaseFontToNormal}
          onCopyConfig={handleCopyTuningConfig}
          onResetTuning={handleResetTuning}
        />
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[264px_minmax(0,1fr)]">
        <motion.aside
          initial={panelMotion.initial}
          animate={panelMotion.animate}
          transition={{ ...springSoft, delay: getStaggerDelay(2, 0.06) }}
          className="min-h-0"
        >
          <div className="flex h-full flex-col gap-4">
            <div className={`min-h-0 overflow-y-auto pl-3 pr-1 ${SUBTLE_SCROLLBAR_CLASS}`}>
              {explorerRows.length > 0 ? (
                <div>
                  {explorerRows.map((row) => (
                    <ExplorerTreeRow
                      key={row.id}
                      row={row}
                      fireSizePx={effectiveFireTuning.fireSizePx}
                    />
                  ))}
                </div>
              ) : (
                <EmptyPanelState message="Visible repository nodes will appear here as the timeline advances." />
              )}
            </div>
          </div>
        </motion.aside>

        <motion.section
          initial={panelMotion.initial}
          animate={panelMotion.animate}
          transition={{ ...springSoft, delay: getStaggerDelay(3, 0.06) }}
          className="min-h-0"
        >
          <div className="flex h-full flex-col gap-4">
            <div
              className={`grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto pr-1 2xl:grid-cols-2 ${SUBTLE_SCROLLBAR_CLASS}`}
            >
              <AnimatePresence initial={false}>
                {featuredSections.length > 0 ? (
                  featuredSections.map((section, index) => (
                    <motion.article
                      key={section.id}
                      layout
                      initial={sectionPresenceMotion.initial}
                      animate={sectionPresenceMotion.animate}
                      exit={sectionPresenceMotion.exit}
                      transition={{
                        layout: springSoft,
                        opacity: { duration: 0.2 },
                        y: { duration: 0.22 },
                        scale: springSoft,
                        delay: getStaggerDelay(index, 0.02),
                      }}
                      className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.02))] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] uppercase tracking-[0.26em] text-slate-500">
                              {section.kindLabel}
                            </span>
                            <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                              {formatNumber(section.visibleNodeCount)} nodes
                            </span>
                          </div>
                          <h2 className="mt-2 truncate font-display text-xl tracking-[-0.04em] text-white">
                            {section.title}
                          </h2>
                          <p className="mt-1 text-[12px] leading-5 text-slate-400">
                            {formatNumber(section.nodes.length)} visible cards from the simplified
                            display tree
                          </p>
                        </div>

                        <span className="rounded-full border border-teal-400/20 bg-teal-400/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-teal-100">
                          {section.totalVisualWeight.toFixed(1)} weight
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-4 gap-3 xl:grid-cols-5">
                        <AnimatePresence initial={false} mode="popLayout">
                          {section.nodes.map((entry) => (
                            <RepoDisplayCard
                              key={entry.node.id}
                              entry={entry}
                              sectionPath={section.path}
                              shouldReduceMotion={shouldReduceMotion}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    </motion.article>
                  ))
                ) : (
                  <motion.div
                    key="empty-repo-state"
                    initial={sectionPresenceMotion.initial}
                    animate={sectionPresenceMotion.animate}
                    exit={sectionPresenceMotion.exit}
                    className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm leading-6 text-slate-400"
                  >
                    No repository nodes are visible at the selected position yet.
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.section>
      </div>
    </>
  )
}

function ControlButton({
  label,
  onClick,
  disabled,
  isPrimary = false,
  isCompact = false,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  isPrimary?: boolean
  isCompact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border transition disabled:cursor-not-allowed disabled:opacity-40 ${
        isCompact ? 'px-3 py-1.5 text-[11px]' : 'px-4 py-2 text-sm'
      } ${
        isPrimary
          ? 'border-teal-300/25 bg-teal-300/14 text-teal-50 hover:bg-teal-300/18'
          : 'border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]'
      }`}
    >
      {label}
    </button>
  )
}

function FloatingPlaybackControls({
  shouldReduceMotion,
  stageBounds,
  isPlaying,
  canStepBackward,
  canStepForward,
  hasTimeline,
  timelineLength,
  maxUnitIndex,
  activeUnitIndex,
  activeUnitLabel,
  activeOrderLabel,
  playbackDurationSeconds,
  playbackSpeed,
  fullRunDurationSeconds,
  remainingPlaybackSeconds,
  remainingUnitCount,
  visibleNodeCount,
  visibleFolderCount,
  recentTouchedCount,
  onTogglePlayback,
  onReset,
  onStepBackward,
  onStepForward,
  onSelectDuration,
  onSelectSpeed,
  onProgressChange,
}: {
  shouldReduceMotion: boolean
  stageBounds: ViewportBounds | null
  isPlaying: boolean
  canStepBackward: boolean
  canStepForward: boolean
  hasTimeline: boolean
  timelineLength: number
  maxUnitIndex: number
  activeUnitIndex: number
  activeUnitLabel: string
  activeOrderLabel: string
  playbackDurationSeconds: PlaybackDurationSeconds
  playbackSpeed: PlaybackSpeed
  fullRunDurationSeconds: number
  remainingPlaybackSeconds: number
  remainingUnitCount: number
  visibleNodeCount: number
  visibleFolderCount: number
  recentTouchedCount: number
  onTogglePlayback: () => void
  onReset: () => void
  onStepBackward: () => void
  onStepForward: () => void
  onSelectDuration: (durationSeconds: PlaybackDurationSeconds) => void
  onSelectSpeed: (speed: PlaybackSpeed) => void
  onProgressChange: (nextIndex: number) => void
}) {
  const [layout, setLayout] = useState<FloatingPlaybackLayout>('vertical')
  const [isExpanded, setIsExpanded] = useState(false)
  const presenceMotion = getScaleFade(shouldReduceMotion)
  const expandedMotion = getFadeSlideUp(shouldReduceMotion, 6)
  const isVertical = layout === 'vertical'
  const floatingStyle = getFloatingPlaybackPosition(layout, stageBounds)
  const utilityButtonClass =
    'inline-flex h-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-3 text-[11px] text-slate-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40'

  const content = (
    <div
      style={floatingStyle}
      className="pointer-events-none fixed z-30"
    >
      <motion.div
        initial={presenceMotion.initial}
        animate={presenceMotion.animate}
        transition={{ ...springSoft, delay: getStaggerDelay(1, 0.05) }}
        className={`pointer-events-auto overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/72 p-3 shadow-[0_22px_60px_rgba(2,6,23,0.34)] backdrop-blur-md ${
          isVertical
            ? 'w-auto max-w-[calc(100vw-2.5rem)]'
            : 'max-w-[calc(100vw-2.5rem)]'
        }`}
      >
        <div
          className={
            isVertical
              ? 'flex w-fit flex-col items-center gap-3'
              : 'flex flex-wrap items-center gap-3'
          }
        >
          <div
            className={`flex gap-2 ${
              isVertical ? 'flex-col items-center self-stretch' : 'flex-wrap items-center'
            }`}
          >
            <ControlButton
              label={isPlaying ? 'Pause' : 'Play'}
              onClick={onTogglePlayback}
              disabled={!hasTimeline}
              isPrimary
              isCompact
            />
            <ControlButton
              label="Reset"
              onClick={onReset}
              disabled={!hasTimeline || activeUnitIndex === 0}
              isCompact
            />
            <button
              type="button"
              onClick={() => {
                setIsExpanded((current) => !current)
              }}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Hide playback details' : 'Show playback details'}
              className={`${utilityButtonClass} w-8 px-0`}
            >
              {isExpanded ? '-' : '+'}
            </button>
            <button
              type="button"
              onClick={() => {
                setLayout((current) =>
                  current === 'vertical' ? 'horizontal' : 'vertical',
                )
              }}
              aria-label={`Switch floating controls to ${
                isVertical ? 'horizontal' : 'vertical'
              } layout`}
              className={utilityButtonClass}
            >
              {isVertical ? 'Vertical' : 'Horizontal'}
            </button>
          </div>

          <div
            className={
              isVertical
                ? 'flex items-center justify-center self-center py-1'
                : 'min-w-[12rem] flex-1 space-y-1.5'
            }
          >
            <input
              type="range"
              min={0}
              max={maxUnitIndex}
              step={1}
              value={activeUnitIndex}
              onChange={(event) => {
                onProgressChange(Number.parseInt(event.target.value, 10))
              }}
              disabled={!hasTimeline}
              aria-label="Repository timeline position"
              className={`cursor-pointer appearance-none rounded-full bg-slate-800 accent-teal-300 disabled:cursor-not-allowed disabled:opacity-40 ${
                isVertical ? 'h-40 w-1.5' : 'h-1.5 w-full'
              }`}
              style={
                isVertical
                  ? ({
                      writingMode: 'vertical-lr',
                      WebkitAppearance: 'slider-vertical',
                    } as CSSProperties)
                  : undefined
              }
            />
          </div>

          <div
            className={`${
              isVertical ? 'space-y-2 self-center' : 'flex flex-wrap items-center gap-3'
            }`}
          >
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                Duration
              </div>
              <div
                className={`flex gap-1.5 ${
                  isVertical ? 'flex-col items-start' : 'flex-wrap items-center'
                }`}
              >
                {PLAYBACK_DURATION_OPTIONS.map((durationSeconds) => (
                  <DurationButton
                    key={durationSeconds}
                    durationSeconds={durationSeconds}
                    isActive={playbackDurationSeconds === durationSeconds}
                    onClick={() => {
                      onSelectDuration(durationSeconds)
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                Speed
              </div>
              <div
                className={`flex gap-1.5 ${
                  isVertical ? 'flex-col items-start' : 'flex-wrap items-center'
                }`}
              >
                {PLAYBACK_SPEED_OPTIONS.map((speed) => (
                  <SpeedButton
                    key={speed}
                    speed={speed}
                    isActive={playbackSpeed === speed}
                    onClick={() => {
                      onSelectSpeed(speed)
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isExpanded ? (
            <motion.div
              initial={expandedMotion.initial}
              animate={expandedMotion.animate}
              exit={expandedMotion.exit}
              transition={springSoft}
              className={`mt-3 border-t border-white/8 pt-3 ${
                isVertical ? 'space-y-3' : 'flex flex-wrap items-start gap-3'
              }`}
            >
              <div
                className={`flex gap-2 ${
                  isVertical ? 'justify-center' : 'flex-wrap items-center'
                }`}
              >
                <ControlButton
                  label="Previous"
                  onClick={onStepBackward}
                  disabled={!canStepBackward}
                  isCompact
                />
                <ControlButton
                  label="Next"
                  onClick={onStepForward}
                  disabled={!canStepForward}
                  isCompact
                />
              </div>

              <div
                className={`grid gap-2 ${
                  isVertical
                    ? 'grid-cols-2'
                    : 'min-w-[18rem] flex-1 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'
                }`}
              >
                <PlaybackStatChip
                  label="Unit"
                  value={activeUnitLabel}
                />
                <PlaybackStatChip
                  label="Total units"
                  value={formatNumber(timelineLength)}
                />
                <PlaybackStatChip
                  label="Order"
                  value={activeOrderLabel}
                />
                <PlaybackStatChip
                  label="Full run"
                  value={formatDurationSeconds(fullRunDurationSeconds)}
                />
                <PlaybackStatChip
                  label="Remaining"
                  value={
                    remainingUnitCount > 0
                      ? formatDurationSeconds(remainingPlaybackSeconds)
                      : 'Complete'
                  }
                />
                <PlaybackStatChip
                  label="Visible"
                  value={`${formatNumber(visibleNodeCount)} nodes`}
                />
                <PlaybackStatChip
                  label="Folders"
                  value={formatNumber(visibleFolderCount)}
                />
                <PlaybackStatChip
                  label="Pulse"
                  value={`${formatNumber(recentTouchedCount)} recent`}
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </div>
  )

  if (typeof document === 'undefined') {
    return content
  }

  return createPortal(content, document.body)
}

function PlaybackStatChip({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-[11px] text-slate-200">
        {value}
      </div>
    </div>
  )
}

function SpeedButton({
  speed,
  isActive,
  onClick,
}: {
  speed: PlaybackSpeed
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 font-mono text-[11px] transition ${
        isActive
          ? 'border-cyan-300/25 bg-cyan-300/14 text-cyan-50'
          : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
      }`}
    >
      {formatPlaybackSpeed(speed)}
    </button>
  )
}

function DurationButton({
  durationSeconds,
  isActive,
  onClick,
}: {
  durationSeconds: PlaybackDurationSeconds
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 font-mono text-[11px] transition ${
        isActive
          ? 'border-violet-300/25 bg-violet-300/14 text-violet-50'
          : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
      }`}
    >
      {formatDurationPreset(durationSeconds)}
    </button>
  )
}

function ExplorerTreeRow({
  row,
  fireSizePx,
}: {
  row: ExplorerRow
  fireSizePx: number
}) {
  const gutterWidth = row.depth * SIDEBAR_TREE_INDENT
  const trackedGrowthIntensity = row.sizeTracking?.growthIntensity ?? 0
  const rowMinHeightRem = row.sizeTracking?.rowHeightRem ?? null
  const rowFontSizeRem = row.sizeTracking?.fontSizeRem ?? null
  const rowFontWeight = Math.round(500 + trackedGrowthIntensity * 110)
  const currentColumnOffset =
    row.depth > 0
      ? (row.depth - 1) * SIDEBAR_TREE_INDENT + SIDEBAR_TREE_INDENT / 2
      : 0
  const lineColor = 'rgba(148, 163, 184, 0.3)'
  const highlightLineColor = 'rgba(94, 234, 212, 0.32)'
  const connectorColor = row.recentlyChanged ? highlightLineColor : lineColor

  return (
    <div
      title={row.path}
      className={`relative flex min-h-6 items-stretch gap-5 rounded-md px-2 py-0.5 text-[13px] leading-5 transition ${
        row.recentlyChanged
          ? 'bg-teal-400/[0.07] text-slate-100'
          : row.type === 'folder'
            ? 'text-slate-200'
            : row.type === 'collapsedFolder'
              ? 'text-amber-100'
              : 'text-slate-300'
      }`}
      style={{
        minHeight: rowMinHeightRem ? `${rowMinHeightRem}rem` : undefined,
        fontSize: rowFontSizeRem ? `${rowFontSizeRem}rem` : undefined,
      }}
    >
      {row.depth > 0 ? (
        <div
          aria-hidden
          className="relative shrink-0 self-stretch"
          style={{ width: `${gutterWidth}px` }}
        >
          {row.ancestorHasNextSibling.map((continues, index) =>
            continues ? (
              <span
                key={`${row.id}:ancestor:${index}`}
                className="absolute top-[-2px] bottom-[-2px] border-l"
                style={{
                  left: `${index * SIDEBAR_TREE_INDENT + SIDEBAR_TREE_INDENT / 2}px`,
                  borderColor: connectorColor,
                }}
              />
            ) : null,
          )}

          <span
            className="absolute border-l border-b"
            style={{
              left: `${currentColumnOffset}px`,
              top: 0,
              width: `${SIDEBAR_TREE_INDENT / 2 + 13}px`,
              height: '50%',
              borderColor: connectorColor,
              borderBottomLeftRadius: '7px',
            }}
          />
          {row.hasNextSibling ? (
            <span
              className="absolute top-[50%] bottom-[-2px] border-l"
              style={{
                left: `${currentColumnOffset}px`,
                borderColor: connectorColor,
              }}
            />
          ) : null}
        </div>
      ) : null}

      <div className="relative flex min-w-0 flex-1 items-center justify-between gap-3">
        <RowFireIndicators
          fireTier={row.activityFire?.fireTier ?? 0}
          fireSizePx={fireSizePx}
        />
        <span
          className="min-w-0 truncate pt-[1px]"
          style={{
            fontWeight: rowFontWeight,
            transform: 'translateY(-2px)',
          }}
        >
          {row.label}
        </span>
        {row.hiddenDescendantCount > 0 && row.type !== 'file' ? (
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            {formatNumber(row.hiddenDescendantCount)} hidden
          </span>
        ) : null}
      </div>
    </div>
  )
}

function FloatingModelWarningsPanel({
  warnings,
  shouldReduceMotion,
}: {
  warnings: string[]
  shouldReduceMotion: boolean
}) {
  if (warnings.length === 0) {
    return null
  }

  const [isOpen, setIsOpen] = useState(false)
  const presenceMotion = getScaleFade(shouldReduceMotion)

  return (
    <div className="pointer-events-none absolute right-5 top-5 z-20 sm:right-6 sm:top-6">
      <div className="pointer-events-auto flex w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col items-end gap-2">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls="repo-model-warnings-panel"
          aria-label={isOpen ? 'Hide model warnings' : 'Show model warnings'}
          onClick={() => {
            setIsOpen((current) => !current)
          }}
          className="grid h-11 w-11 place-items-center rounded-full border border-amber-300/20 bg-slate-950/88 text-lg text-amber-100 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:bg-slate-900/92"
        >
          <span aria-hidden="true">&#9888;</span>
        </button>

        <AnimatePresence initial={false}>
          {isOpen ? (
            <motion.aside
              id="repo-model-warnings-panel"
              initial={presenceMotion.initial}
              animate={presenceMotion.animate}
              exit={presenceMotion.exit}
              transition={springSoft}
              className="max-h-[70vh] w-full overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,28,0.96),rgba(4,8,18,0.96))] shadow-[0_28px_90px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md"
            >
              <div className="max-h-[70vh] overflow-y-auto p-4">
                <div className="space-y-2 text-[13px] leading-5 text-slate-300">
                  {warnings.slice(0, 4).map((warning) => (
                    <div
                      key={warning}
                      className="rounded-[16px] border border-amber-400/15 bg-amber-400/[0.05] px-3 py-2.5 text-amber-50/90"
                    >
                      {warning}
                    </div>
                  ))}
                </div>
              </div>
            </motion.aside>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}

function FloatingRepoTuningPanel({
  shouldReduceMotion,
  trackedNodeControls,
  tuningState,
  hottestActivityFire,
  statusMessage,
  onUpdateStyleValue,
  onUpdateFireTuningValue,
  onUpdateTrackedNodePercent,
  onSetBaseFontToNormal,
  onCopyConfig,
  onResetTuning,
}: {
  shouldReduceMotion: boolean
  trackedNodeControls: TrackedRepoNodeTuningControl[]
  tuningState: RepoExplorerTuningState
  hottestActivityFire: RepoExplorerFireDebugState | null
  statusMessage: string | null
  onUpdateStyleValue: (
    key: keyof RepoDisplaySizeTrackingStyle,
    nextValue: number,
  ) => void
  onUpdateFireTuningValue: (
    key: keyof RepoExplorerFireTuningState,
    nextValue: number,
  ) => void
  onUpdateTrackedNodePercent: (path: string, nextValue: number) => void
  onSetBaseFontToNormal: () => void
  onCopyConfig: () => Promise<void>
  onResetTuning: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const presenceMotion = getScaleFade(shouldReduceMotion)

  return (
    <div className="pointer-events-none absolute bottom-5 right-5 z-20 sm:bottom-6 sm:right-6">
      <div className="pointer-events-auto flex w-[21rem] max-w-[calc(100vw-2.5rem)] flex-col-reverse items-end gap-2">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls="repo-live-tuning-panel"
          onClick={() => {
            setIsOpen((current) => !current)
          }}
          className="rounded-full border border-white/10 bg-slate-950/88 px-4 py-2 text-[12px] font-medium uppercase tracking-[0.24em] text-slate-100 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:bg-slate-900/92"
        >
          Tune
        </button>

        <AnimatePresence initial={false}>
          {isOpen ? (
            <motion.aside
              id="repo-live-tuning-panel"
              initial={presenceMotion.initial}
              animate={presenceMotion.animate}
              exit={presenceMotion.exit}
              transition={springSoft}
              className="max-h-[74vh] w-full overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,28,0.96),rgba(4,8,18,0.96))] shadow-[0_28px_90px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md"
            >
              <div className="max-h-[74vh] overflow-y-auto p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                      Live tuning
                    </div>
                    <div className="mt-1 text-[13px] leading-5 text-slate-200">
                      Visual overrides only. Structure still comes from the loaded display model.
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
                    {formatNumber(trackedNodeControls.length)} tracked
                  </span>
                </div>

                <div className="mt-4 space-y-4">
                  <section className="space-y-3">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                      Global style
                    </div>
                    <TuningRangeControl
                      label="Base row height"
                      value={tuningState.sizeTrackingStyle.baseRowHeightRem}
                      min={SIZE_TRACKING_STYLE_RANGES.baseRowHeightRem.min}
                      max={SIZE_TRACKING_STYLE_RANGES.baseRowHeightRem.max}
                      step={SIZE_TRACKING_STYLE_RANGES.baseRowHeightRem.step}
                      valueSuffix="rem"
                      valueDecimals={2}
                      onChange={(nextValue) => {
                        onUpdateStyleValue('baseRowHeightRem', nextValue)
                      }}
                    />
                    <TuningRangeControl
                      label="Max extra height"
                      value={tuningState.sizeTrackingStyle.maxExtraHeightRem}
                      min={SIZE_TRACKING_STYLE_RANGES.maxExtraHeightRem.min}
                      max={SIZE_TRACKING_STYLE_RANGES.maxExtraHeightRem.max}
                      step={SIZE_TRACKING_STYLE_RANGES.maxExtraHeightRem.step}
                      valueSuffix="rem"
                      valueDecimals={2}
                      onChange={(nextValue) => {
                        onUpdateStyleValue('maxExtraHeightRem', nextValue)
                      }}
                    />
                    <TuningRangeControl
                      label="Base font size"
                      value={tuningState.sizeTrackingStyle.baseFontSizeRem}
                      min={SIZE_TRACKING_STYLE_RANGES.baseFontSizeRem.min}
                      max={SIZE_TRACKING_STYLE_RANGES.baseFontSizeRem.max}
                      step={SIZE_TRACKING_STYLE_RANGES.baseFontSizeRem.step}
                      valueSuffix="rem"
                      valueDecimals={4}
                      onChange={(nextValue) => {
                        onUpdateStyleValue('baseFontSizeRem', nextValue)
                      }}
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={onSetBaseFontToNormal}
                        className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-200 transition hover:bg-white/[0.06]"
                      >
                        Set base font 13px
                      </button>
                    </div>
                    <TuningRangeControl
                      label="Max extra font"
                      value={tuningState.sizeTrackingStyle.maxExtraFontSizeRem}
                      min={SIZE_TRACKING_STYLE_RANGES.maxExtraFontSizeRem.min}
                      max={SIZE_TRACKING_STYLE_RANGES.maxExtraFontSizeRem.max}
                      step={SIZE_TRACKING_STYLE_RANGES.maxExtraFontSizeRem.step}
                      valueSuffix="rem"
                      valueDecimals={2}
                      onChange={(nextValue) => {
                        onUpdateStyleValue('maxExtraFontSizeRem', nextValue)
                      }}
                    />
                  </section>

                  <section className="space-y-3">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                      Per tracked node
                    </div>
                    {trackedNodeControls.map((node) => (
                      <TuningRangeControl
                        key={node.path}
                        label={node.path}
                        value={tuningState.maxVisualPercentByNodePath[node.path] ?? node.defaultMaxVisualPercent}
                        min={MAX_VISUAL_PERCENT_RANGE.min}
                        max={MAX_VISUAL_PERCENT_RANGE.max}
                        step={MAX_VISUAL_PERCENT_RANGE.step}
                        valueSuffix="%"
                        valueDecimals={0}
                        onChange={(nextValue) => {
                          onUpdateTrackedNodePercent(node.path, nextValue)
                        }}
                      />
                    ))}
                  </section>

                  <section className="space-y-3">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                      Fire
                    </div>
                    <TuningRangeControl
                      label="Fire window size"
                      value={tuningState.fireTuning.fireWindowSize}
                      min={FIRE_TUNING_RANGES.fireWindowSize.min}
                      max={FIRE_TUNING_RANGES.fireWindowSize.max}
                      step={FIRE_TUNING_RANGES.fireWindowSize.step}
                      valueSuffix="u"
                      valueDecimals={0}
                      onChange={(nextValue) => {
                        onUpdateFireTuningValue('fireWindowSize', nextValue)
                      }}
                    />
                    <TuningRangeControl
                      label="Tier 1 threshold"
                      value={tuningState.fireTuning.tier1Threshold}
                      min={FIRE_TUNING_RANGES.tier1Threshold.min}
                      max={FIRE_TUNING_RANGES.tier1Threshold.max}
                      step={FIRE_TUNING_RANGES.tier1Threshold.step}
                      valueSuffix=""
                      valueDecimals={2}
                      onChange={(nextValue) => {
                        onUpdateFireTuningValue('tier1Threshold', nextValue)
                      }}
                    />
                    <TuningRangeControl
                      label="Tier 2 threshold"
                      value={tuningState.fireTuning.tier2Threshold}
                      min={FIRE_TUNING_RANGES.tier2Threshold.min}
                      max={FIRE_TUNING_RANGES.tier2Threshold.max}
                      step={FIRE_TUNING_RANGES.tier2Threshold.step}
                      valueSuffix=""
                      valueDecimals={2}
                      onChange={(nextValue) => {
                        onUpdateFireTuningValue('tier2Threshold', nextValue)
                      }}
                    />
                    <TuningRangeControl
                      label="Tier 3 threshold"
                      value={tuningState.fireTuning.tier3Threshold}
                      min={FIRE_TUNING_RANGES.tier3Threshold.min}
                      max={FIRE_TUNING_RANGES.tier3Threshold.max}
                      step={FIRE_TUNING_RANGES.tier3Threshold.step}
                      valueSuffix=""
                      valueDecimals={2}
                      onChange={(nextValue) => {
                        onUpdateFireTuningValue('tier3Threshold', nextValue)
                      }}
                    />
                    <TuningRangeControl
                      label="Fire size"
                      value={tuningState.fireTuning.fireSizePx}
                      min={FIRE_TUNING_RANGES.fireSizePx.min}
                      max={FIRE_TUNING_RANGES.fireSizePx.max}
                      step={FIRE_TUNING_RANGES.fireSizePx.step}
                      valueSuffix="px"
                      valueDecimals={0}
                      onChange={(nextValue) => {
                        onUpdateFireTuningValue('fireSizePx', nextValue)
                      }}
                    />
                    <div className="rounded-[16px] border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[11px] leading-5 text-slate-300">
                      {hottestActivityFire ? (
                        <>
                          <div className="font-mono uppercase tracking-[0.18em] text-slate-500">
                            Hottest tracked node
                          </div>
                          <div className="mt-1 truncate text-slate-100">
                            {hottestActivityFire.nodePath}
                          </div>
                          <div className="mt-1 font-mono text-slate-400">
                            heat {formatTuningValue(hottestActivityFire.heatScore, 2)} · tier{' '}
                            {hottestActivityFire.fireTier} · {formatNumber(hottestActivityFire.recentHits)} hits
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-mono uppercase tracking-[0.18em] text-slate-500">
                            Hottest tracked node
                          </div>
                          <div className="mt-1 text-slate-400">
                            No recent fire activity in the current window.
                          </div>
                        </>
                      )}
                    </div>
                  </section>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCopying(true)
                      void onCopyConfig().finally(() => {
                        setIsCopying(false)
                      })
                    }}
                    disabled={isCopying}
                    className="rounded-full border border-teal-300/20 bg-teal-300/12 px-3 py-1.5 text-[11px] text-teal-50 transition hover:bg-teal-300/16 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Copy config JSON
                  </button>
                  <button
                    type="button"
                    onClick={onResetTuning}
                    className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-200 transition hover:bg-white/[0.06]"
                  >
                    Reset tuning
                  </button>
                </div>

                <div className="mt-3 min-h-5 text-[11px] text-slate-400">
                  {statusMessage ?? 'Saved in localStorage for this browser only.'}
                </div>
              </div>
            </motion.aside>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}

function TuningRangeControl({
  label,
  value,
  min,
  max,
  step,
  valueSuffix,
  valueDecimals,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  valueSuffix: string
  valueDecimals: number
  onChange: (nextValue: number) => void
}) {
  return (
    <label className="block">
      <div className="flex items-start justify-between gap-3">
        <span
          title={label}
          className="min-w-0 truncate text-[12px] leading-5 text-slate-200"
        >
          {label}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-slate-400">
          {formatTuningValue(value, valueDecimals)}
          {valueSuffix}
        </span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          onChange(Number.parseFloat(event.target.value))
        }}
        className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-teal-300"
      />
    </label>
  )
}

function RowFireIndicators({
  fireTier,
  fireSizePx,
}: {
  fireTier: 0 | 1 | 2 | 3
  fireSizePx: number
}) {
  if (fireTier < 1) {
    return null
  }

  const fireScale = fireSizePx / DEFAULT_FIRE_SIZE_PX
  const fires = [
    { key: 'core', x: -16, y: -9, rotation: -82, opacity: 0.96 },
    { key: 'lower', x: -6, y: 2, rotation: -108, opacity: 0.84 },
    { key: 'upper', x: -4, y: -19, rotation: -58, opacity: 0.78 },
  ].slice(0, fireTier)

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-[-4px] top-1/2 z-10"
    >
      {fires.map((fire) => (
        <img
          key={fire.key}
          src={FIRE_GIF_ASSET_URL}
          alt=""
          className="absolute max-w-none select-none mix-blend-screen"
          style={{
            width: `${fireSizePx}px`,
            height: `${fireSizePx}px`,
            left: `${Math.round(fire.x * fireScale)}px`,
            top: `${Math.round(fire.y * fireScale)}px`,
            opacity: fire.opacity,
            transform: `rotate(${fire.rotation}deg)`,
          }}
        />
      ))}
    </div>
  )
}

function RepoDisplayCard({
  entry,
  sectionPath,
  shouldReduceMotion,
}: {
  entry: VisibleRepoNode
  sectionPath: string
  shouldReduceMotion: boolean
}) {
  const { node, state, currentVisualScale, currentVisualSize, highlightStrength } = entry
  const layout = FILE_SIZE_LAYOUT[currentVisualSize]
  const typeStyle = NODE_TYPE_STYLES[node.type]
  const glowOpacity =
    highlightStrength > 0
      ? clampNumber(0.14 + highlightStrength * 0.34, 0.14, 0.5)
      : 0
  const borderColor =
    highlightStrength > 0 ? 'rgba(45,212,191,0.28)' : 'rgba(255,255,255,0.08)'
  const effectiveMinHeight = Math.round(
    layout.baseMinHeight * clampNumber(currentVisualScale, 0.78, 1.16),
  )
  const currentRatio =
    state.maxLineCount > 0
      ? clampNumber(state.currentLineCount / state.maxLineCount, 0, 1)
      : 0
  const presenceMotion = getScaleFade(shouldReduceMotion)
  const secondaryLabel = getCardSecondaryLabel(entry, sectionPath)
  const tertiaryLabel = getCardTertiaryLabel(entry)

  return (
    <motion.article
      layout
      initial={presenceMotion.initial}
      animate={presenceMotion.animate}
      exit={presenceMotion.exit}
      transition={{
        layout: springSoft,
        opacity: { duration: 0.2 },
        y: { duration: 0.22 },
        scale: springSoft,
      }}
      style={{
        minHeight: `${effectiveMinHeight}px`,
        borderColor,
        boxShadow:
          highlightStrength > 0
            ? `0 18px 42px rgba(5,10,20,0.34), 0 0 ${14 + highlightStrength * 20}px rgba(45,212,191,${0.08 + highlightStrength * 0.14}), inset 0 1px 0 rgba(255,255,255,0.04)`
            : 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
      className={`${layout.span} relative overflow-hidden rounded-[20px] border bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-3`}
    >
      {highlightStrength > 0 ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[20px] bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.34),transparent_58%)]"
          animate={
            shouldReduceMotion
              ? { opacity: glowOpacity }
              : {
                  opacity: [glowOpacity * 0.55, glowOpacity, glowOpacity * 0.55],
                  scale: [0.985, 1.02, 0.985],
                }
          }
          transition={{
            duration: 1.8,
            repeat: shouldReduceMotion ? 0 : Number.POSITIVE_INFINITY,
            ease: 'easeInOut',
          }}
        />
      ) : null}

      <div
        className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${typeStyle.glow}`}
      />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate font-display text-[15px] font-medium tracking-[-0.03em] text-white">
                {node.label}
              </div>
              {state.recentlyChanged ? (
                <motion.span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full bg-teal-300"
                  animate={
                    shouldReduceMotion
                      ? { opacity: 0.9 }
                      : {
                          opacity: [0.4, 1, 0.4],
                          scale: [0.95, 1.22, 0.95],
                        }
                  }
                  transition={{
                    duration: 1.4,
                    repeat: shouldReduceMotion ? 0 : Number.POSITIVE_INFINITY,
                    ease: 'easeInOut',
                  }}
                />
              ) : null}
            </div>
            <div className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
              {secondaryLabel}
            </div>
          </div>

          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] ${typeStyle.badge}`}
          >
            {typeStyle.label}
          </span>
        </div>

        <div className="mt-4 flex-1">
          <div className="grid gap-1.5">
            <div className="h-1.5 w-full rounded-full bg-white/6">
              <motion.div
                className="h-full rounded-full bg-[linear-gradient(90deg,rgba(56,189,248,0.75),rgba(45,212,191,0.9))]"
                animate={{
                  width: `${Math.max(18, Math.min(100, currentRatio * 100))}%`,
                }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
              />
            </div>
            <div className="grid grid-cols-3 gap-1.5 opacity-80">
              <div className="h-1 rounded-full bg-white/8" />
              <div className="h-1 rounded-full bg-white/6" />
              <div className="h-1 rounded-full bg-white/10" />
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3 text-[11px] text-slate-400">
          <div>
            <div className="font-mono uppercase tracking-[0.2em] text-slate-500">
              {SIZE_LABELS[currentVisualSize]}
            </div>
            <div className="mt-1 text-slate-200">
              {formatNumber(state.currentLineCount)} current lines
            </div>
          </div>

          <div className="text-right">
            <div className="font-mono uppercase tracking-[0.2em] text-slate-500">
              {tertiaryLabel}
            </div>
            <div className="mt-1 text-slate-200">
              {node.type === 'file'
                ? formatNumber(node.maxLineCount)
                : formatNumber(
                    node.hiddenDescendantCount > 0
                      ? node.hiddenDescendantCount
                      : node.childCount,
                  )}
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  )
}

function EmptyPanelState({
  message,
}: {
  message: string
}) {
  return (
    <div className="rounded-[18px] border border-dashed border-white/10 bg-white/[0.02] px-3 py-3 text-[13px] leading-5 text-slate-500">
      {message}
    </div>
  )
}

function RepoExplorerSkeleton() {
  return (
    <>
      <div className="pointer-events-none fixed right-5 top-1/2 z-30 -translate-y-1/2 sm:right-6">
        <div className="w-[18rem] max-w-[calc(100vw-2.5rem)] rounded-[24px] border border-white/8 bg-white/[0.05] p-3 shadow-[0_22px_60px_rgba(2,6,23,0.2)] backdrop-blur-md">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-8 w-14 rounded-full bg-white/[0.08]" />
              <div className="h-8 w-14 rounded-full bg-white/[0.07]" />
              <div className="h-8 w-8 rounded-full bg-white/[0.07]" />
              <div className="h-8 w-20 rounded-full bg-white/[0.07]" />
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.08]" />
            <div className="space-y-2">
              <div className="space-y-1.5">
                <div className="h-3 w-14 rounded-full bg-white/[0.06]" />
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={`duration-${index}`}
                      className="h-7 w-11 rounded-full bg-white/[0.07]"
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-10 rounded-full bg-white/[0.06]" />
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={`speed-${index}`}
                      className="h-7 w-11 rounded-full bg-white/[0.07]"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[264px_minmax(0,1fr)]">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
          <div className="space-y-3">
            {Array.from({ length: 12 }).map((_, index) => (
              <div
                key={index}
                className="h-6 rounded-md bg-white/[0.04]"
              />
            ))}
          </div>
        </div>

        <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-4">
          <div className="grid h-full grid-cols-1 gap-4 2xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-[24px] bg-white/[0.04] p-4"
              >
                <div className="h-5 w-40 rounded-full bg-white/8" />
                <div className="mt-4 grid grid-cols-4 gap-3">
                  {Array.from({ length: 6 }).map((__, cardIndex) => (
                    <div
                      key={cardIndex}
                      className="col-span-2 min-h-[88px] rounded-[20px] bg-white/[0.05]"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function getFloatingPlaybackPosition(
  layout: FloatingPlaybackLayout,
  stageBounds: ViewportBounds | null,
) {
  if (typeof window === 'undefined' || !stageBounds) {
    return layout === 'vertical'
      ? {
          right: '0px',
          top: '50%',
          transform: 'translateY(-50%)',
        }
      : {
          left: '50%',
          top: '1.5rem',
          transform: 'translateX(-50%)',
        }
  }

  const viewportPadding = 20
  const gap = 18

  if (layout === 'vertical') {
    const panelWidth = 288
    const availableRight = window.innerWidth - stageBounds.right - viewportPadding
    const availableLeft = stageBounds.left - viewportPadding
    const alignRight =
      availableRight >= panelWidth + gap || availableRight >= availableLeft

    if (alignRight) {
      return {
        right: '0px',
        top: `${stageBounds.top + stageBounds.height / 2}px`,
        transform: 'translateY(-50%)',
      }
    }

    const left = clampNumber(
      stageBounds.left - panelWidth - gap,
      viewportPadding,
      window.innerWidth - panelWidth - viewportPadding,
    )

    return {
      left: `${left}px`,
      top: `${stageBounds.top + stageBounds.height / 2}px`,
      transform: 'translateY(-50%)',
    }
  }

  const panelWidth = 760
  const panelHeight = 168
  const left = clampNumber(
    stageBounds.left + stageBounds.width / 2 - panelWidth / 2,
    viewportPadding,
    Math.max(viewportPadding, window.innerWidth - panelWidth - viewportPadding),
  )
  const aboveTop = stageBounds.top - panelHeight - gap
  const top =
    aboveTop >= viewportPadding
      ? aboveTop
      : clampNumber(
          stageBounds.bottom + gap,
          viewportPadding,
          Math.max(viewportPadding, window.innerHeight - panelHeight - viewportPadding),
        )

  return {
    left: `${left}px`,
    top: `${top}px`,
  }
}

function useElementViewportBounds(
  elementRef: RefObject<HTMLElement | null>,
) {
  const [bounds, setBounds] = useState<ViewportBounds | null>(null)

  useEffect(() => {
    const element = elementRef.current

    if (!element) {
      return
    }

    const updateBounds = () => {
      const rect = element.getBoundingClientRect()
      setBounds({
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      })
    }

    updateBounds()

    const resizeObserver = new ResizeObserver(() => {
      updateBounds()
    })

    resizeObserver.observe(element)
    window.addEventListener('resize', updateBounds)
    window.addEventListener('scroll', updateBounds, true)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateBounds)
      window.removeEventListener('scroll', updateBounds, true)
    }
  }, [elementRef])

  return bounds
}

function RepoExplorerError({
  message,
  modelUrl,
}: {
  message: string
  modelUrl: string
}) {
  return (
    <div className="grid flex-1 place-items-center">
      <div className="max-w-xl rounded-[28px] border border-rose-400/20 bg-rose-400/[0.06] p-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="text-[11px] uppercase tracking-[0.28em] text-rose-100/80">
          Repository scene unavailable
        </div>
        <h1 className="mt-4 font-display text-3xl tracking-[-0.04em] text-white">
          The display model could not be loaded.
        </h1>
        <p className="mt-4 text-sm leading-6 text-rose-50/90">
          {message}
        </p>
        <p className="mt-3 text-sm leading-6 text-rose-50/70">
          {modelUrl === LIVE_REPO_DISPLAY_MODEL_URL
            ? 'Re-run the preprocessing pipeline so '
            : 'Refresh or recopy the frozen snapshot so '}
          <code className="rounded bg-black/20 px-1.5 py-0.5 text-[13px]">
            {modelUrl}
          </code>{' '}
          is available for the app.
        </p>
      </div>
    </div>
  )
}

function useRepoProgressState(
  model: RepoDisplayModel,
  activeUnitIndex: number,
  sizeTrackingStyle: RepoDisplaySizeTrackingStyle,
  fireTuning: RepoExplorerFireTuningState,
  maxVisualPercentByNodePath: Record<string, number>,
  enableActivityFireIndicators: boolean,
): RepoProgressState {
  const progressCacheRef = useRef<RepoProgressCache | null>(null)

  return useMemo(() => {
    const replayUnitIndex =
      model.timeline.length > 0
        ? Math.min(activeUnitIndex, model.timeline.length - 1)
        : activeUnitIndex
    const progressCache = getRepoProgressCache(
      model,
      replayUnitIndex,
      progressCacheRef.current,
    )

    progressCacheRef.current = progressCache

    return buildRepoProgressState(
      model,
      activeUnitIndex,
      progressCache.sourceFileStateById,
      sizeTrackingStyle,
      fireTuning,
      maxVisualPercentByNodePath,
      enableActivityFireIndicators,
    )
  }, [
    activeUnitIndex,
    enableActivityFireIndicators,
    fireTuning,
    maxVisualPercentByNodePath,
    model,
    sizeTrackingStyle,
  ])
}

function getRepoProgressCache(
  model: RepoDisplayModel,
  activeUnitIndex: number,
  currentCache: RepoProgressCache | null,
): RepoProgressCache {
  const targetUnitIndex =
    model.timeline.length > 0
      ? clampNumber(activeUnitIndex, 0, model.timeline.length - 1)
      : -1

  const nextCache =
    currentCache && currentCache.model === model
      ? currentCache
      : {
          model,
          activeUnitIndex: model.timeline.length === 0 ? 0 : -1,
          sourceFileStateById: createInitialSourceFileStateById(model),
        }

  if (model.timeline.length === 0) {
    nextCache.activeUnitIndex = 0
    return nextCache
  }

  if (targetUnitIndex > nextCache.activeUnitIndex) {
    for (
      let index = nextCache.activeUnitIndex + 1;
      index <= targetUnitIndex;
      index += 1
    ) {
      const unit = model.timeline[index]

      if (!unit) {
        continue
      }

      const currentFileState = nextCache.sourceFileStateById.get(unit.sourceFileId) ?? {
        exists: false,
        currentLineCount: 0,
      }

      nextCache.sourceFileStateById.set(
        unit.sourceFileId,
        applyTimelineUnitToSourceFileState(currentFileState, unit),
      )
    }
  } else if (targetUnitIndex < nextCache.activeUnitIndex) {
    for (let index = nextCache.activeUnitIndex; index > targetUnitIndex; index -= 1) {
      const unit = model.timeline[index]

      if (!unit) {
        continue
      }

      const currentFileState = nextCache.sourceFileStateById.get(unit.sourceFileId) ?? {
        exists: false,
        currentLineCount: 0,
      }

      nextCache.sourceFileStateById.set(
        unit.sourceFileId,
        revertTimelineUnitFromSourceFileState(currentFileState, unit),
      )
    }
  }

  nextCache.activeUnitIndex = targetUnitIndex

  return nextCache
}

function createInitialSourceFileStateById(model: RepoDisplayModel) {
  const sourceFileStateById = new Map<string, SourceFileReplayState>()

  for (const node of model.nodes) {
    for (const sourceFileId of node.sourceFileIds) {
      if (!sourceFileStateById.has(sourceFileId)) {
        sourceFileStateById.set(sourceFileId, {
          exists: false,
          currentLineCount: 0,
        })
      }
    }
  }

  return sourceFileStateById
}

function buildRepoProgressState(
  model: RepoDisplayModel,
  activeUnitIndex: number,
  sourceFileStateById: Map<string, SourceFileReplayState>,
  sizeTrackingStyle: RepoDisplaySizeTrackingStyle,
  fireTuning: RepoExplorerFireTuningState,
  maxVisualPercentByNodePath: Record<string, number>,
  enableActivityFireIndicators: boolean,
): RepoProgressState {
  const visualWeightReference = calculateDisplayWeightReference(model.nodes)
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]))

  if (model.timeline.length === 0) {
    return {
      activeUnit: null,
      visibleNodes: model.nodes
        .map((node) =>
          createStaticVisibleRepoNode(
            node,
            visualWeightReference,
            sizeTrackingStyle,
            maxVisualPercentByNodePath,
          ),
        )
        .filter((entry): entry is VisibleRepoNode => entry !== null),
      recentTouchedCount: 0,
    }
  }

  const replayUnitIndex = clampNumber(activeUnitIndex, 0, model.timeline.length - 1)
  const isRestFrame = activeUnitIndex >= model.timeline.length
  const activeUnit = isRestFrame ? null : model.timeline[replayUnitIndex] ?? null

  if (!activeUnit && !isRestFrame) {
    return {
      activeUnit: null,
      visibleNodes: [],
      recentTouchedCount: 0,
    }
  }

  const recentActivityByDisplayNodeId = new Map<string, number>()
  const recentFireHitCountByDisplayNodeId = new Map<string, number>()
  const visibilityFrame = findVisibilityFrameForUnitIndex(
    model.visibilityFrames,
    replayUnitIndex,
  )

  if (!isRestFrame) {
    const recentHighlightUnitStartIndex = Math.max(
      0,
      replayUnitIndex - (RECENT_UNIT_WINDOW - 1),
    )
    const recentHeatUnitStartIndex = Math.max(
      0,
      replayUnitIndex - (fireTuning.fireWindowSize - 1),
    )

    for (
      let index = recentHighlightUnitStartIndex;
      index <= replayUnitIndex;
      index += 1
    ) {
      const unit = model.timeline[index]

      if (!unit) {
        continue
      }

      const distance = replayUnitIndex - index
      const recencyFactor = 1 - (distance / RECENT_UNIT_WINDOW) * 0.55
      const intensity = clampNumber(unit.activityWeight * recencyFactor, 0, 1)
      const previousIntensity =
        recentActivityByDisplayNodeId.get(unit.effectiveDisplayNodeId) ?? 0

      if (intensity > previousIntensity) {
        recentActivityByDisplayNodeId.set(unit.effectiveDisplayNodeId, intensity)
      }
    }

    if (enableActivityFireIndicators) {
      for (let index = recentHeatUnitStartIndex; index <= replayUnitIndex; index += 1) {
        const unit = model.timeline[index]

        if (!unit) {
          continue
        }

        recentFireHitCountByDisplayNodeId.set(
          unit.effectiveDisplayNodeId,
          (recentFireHitCountByDisplayNodeId.get(unit.effectiveDisplayNodeId) ?? 0) + 1,
        )
      }
    }
  }

  const visibleNodeIds = visibilityFrame
    ? visibilityFrame.visibleNodeIds
    : model.nodes.map((node) => node.id)

  return {
    activeUnit,
    visibleNodes: visibleNodeIds
      .map((nodeId) => {
        const node = nodeById.get(nodeId)

        if (!node) {
          return null
        }

        return createVisibleRepoNode(
          node,
          sourceFileStateById,
          recentActivityByDisplayNodeId.get(node.id) ?? 0,
          recentFireHitCountByDisplayNodeId.get(node.id) ?? 0,
          visualWeightReference,
          getRepoDisplayNodeCountOverrides(node, visibilityFrame),
          sizeTrackingStyle,
          fireTuning,
          maxVisualPercentByNodePath,
          enableActivityFireIndicators,
        )
      })
      .filter((entry): entry is VisibleRepoNode => entry !== null),
    recentTouchedCount: recentActivityByDisplayNodeId.size,
  }
}

function findVisibilityFrameForUnitIndex(
  visibilityFrames: RepoDisplayVisibilityFrame[],
  unitIndex: number,
): RepoDisplayVisibilityFrame | null {
  if (visibilityFrames.length === 0) {
    return null
  }

  let low = 0
  let high = visibilityFrames.length - 1

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const frame = visibilityFrames[middle]

    if (!frame) {
      break
    }

    if (unitIndex < frame.startUnitIndex) {
      high = middle - 1
      continue
    }

    if (unitIndex > frame.endUnitIndex) {
      low = middle + 1
      continue
    }

    return frame
  }

  return null
}

function getRepoDisplayNodeCountOverrides(
  node: RepoDisplayNode,
  visibilityFrame: RepoDisplayVisibilityFrame | null,
): RepoDisplayNodeCountOverrides | null {
  if (!visibilityFrame || node.type === 'file') {
    return null
  }

  return {
    childCount:
      visibilityFrame.effectiveChildCountByFolderId[node.id] ?? node.childCount,
    visibleChildCount:
      visibilityFrame.effectiveVisibleChildCountByFolderId[node.id] ??
      node.visibleChildCount,
    hiddenChildCount:
      visibilityFrame.effectiveHiddenChildCountByFolderId[node.id] ??
      node.hiddenChildCount,
    hiddenDescendantCount:
      visibilityFrame.effectiveHiddenDescendantCountByFolderId[node.id] ??
      node.hiddenDescendantCount,
  }
}

function createVisibleRepoNode(
  node: RepoDisplayNode,
  sourceFileStateById: Map<string, SourceFileReplayState>,
  highlightStrength: number,
  recentFireHits: number,
  visualWeightReference: number,
  countOverrides: RepoDisplayNodeCountOverrides | null,
  sizeTrackingStyle: RepoDisplaySizeTrackingStyle,
  fireTuning: RepoExplorerFireTuningState,
  maxVisualPercentByNodePath: Record<string, number>,
  enableActivityFireIndicators: boolean,
): VisibleRepoNode | null {
  let exists = false
  let currentLineCount = 0

  for (const sourceFileId of node.sourceFileIds) {
    const sourceFileState = sourceFileStateById.get(sourceFileId)

    if (!sourceFileState) {
      continue
    }

    if (sourceFileState.exists) {
      exists = true
    }

    currentLineCount += sourceFileState.currentLineCount
  }

  if (!exists) {
    return null
  }

  return createVisibleRepoNodeEntry(
    node,
    exists,
    currentLineCount,
    highlightStrength,
    recentFireHits,
    visualWeightReference,
    countOverrides,
    sizeTrackingStyle,
    fireTuning,
    maxVisualPercentByNodePath,
    enableActivityFireIndicators,
  )
}

function createStaticVisibleRepoNode(
  node: RepoDisplayNode,
  visualWeightReference: number,
  sizeTrackingStyle: RepoDisplaySizeTrackingStyle,
  maxVisualPercentByNodePath: Record<string, number>,
): VisibleRepoNode | null {
  if (node.sourceFileIds.length === 0) {
    return null
  }

  return createVisibleRepoNodeEntry(
    node,
    true,
    node.finalLineCount,
    0,
    0,
    visualWeightReference,
    null,
    sizeTrackingStyle,
    createDefaultRepoExplorerFireTuningState(),
    maxVisualPercentByNodePath,
    false,
  )
}

function createVisibleRepoNodeEntry(
  node: RepoDisplayNode,
  exists: boolean,
  currentLineCount: number,
  highlightStrength: number,
  recentFireHits: number,
  visualWeightReference: number,
  countOverrides: RepoDisplayNodeCountOverrides | null,
  sizeTrackingStyle: RepoDisplaySizeTrackingStyle,
  fireTuning: RepoExplorerFireTuningState,
  maxVisualPercentByNodePath: Record<string, number>,
  enableActivityFireIndicators: boolean,
): VisibleRepoNode {
  const effectiveNode = countOverrides
    ? {
        ...node,
        childCount: countOverrides.childCount,
        visibleChildCount: countOverrides.visibleChildCount,
        hiddenChildCount: countOverrides.hiddenChildCount,
        hiddenDescendantCount: countOverrides.hiddenDescendantCount,
      }
    : node
  const currentRatio =
    effectiveNode.maxLineCount > 0
      ? clampNumber(currentLineCount / effectiveNode.maxLineCount, 0, 1)
      : 0
  const currentVisualScale = clampNumber(0.45 + Math.sqrt(currentRatio) * 0.75, 0.45, 1.2)
  const persistentVisualWeight = normalizeDisplayVisualWeight(
    effectiveNode.visualWeight,
    visualWeightReference,
  )
  const currentVisualWeight = Math.max(0.06, persistentVisualWeight * currentVisualScale)
  const currentVisualSize = deriveCurrentVisualSize(
    mapVisualSize(persistentVisualWeight),
    currentVisualScale,
  )
  // Mild damping keeps dense edit bursts from jumping straight to max fire.
  const recentHeatScore =
    fireTuning.fireWindowSize > 0
      ? clampNumber(
          recentFireHits /
            (fireTuning.fireWindowSize * FIRE_HEAT_DAMPING_MULTIPLIER),
          0,
          1,
        )
      : 0

  return {
    node: effectiveNode,
    state: {
      exists,
      currentLineCount,
      maxLineCount: effectiveNode.maxLineCount,
      finalLineCount: effectiveNode.finalLineCount,
      recentlyChanged: exists && highlightStrength > 0,
    },
    currentVisualScale,
    currentVisualSize,
    currentVisualWeight,
    persistentVisualWeight,
    highlightStrength,
    sizeTracking: deriveRepoNodeSizeTrackingState(
      effectiveNode,
      currentLineCount,
      sizeTrackingStyle,
      maxVisualPercentByNodePath[effectiveNode.path],
    ),
    activityFire: deriveRepoNodeActivityFireState(
      effectiveNode,
      recentHeatScore,
      recentFireHits,
      enableActivityFireIndicators,
      fireTuning,
    ),
  }
}

function deriveRepoNodeSizeTrackingState(
  node: RepoDisplayNode,
  currentLineCount: number,
  sizeTrackingStyle: RepoDisplaySizeTrackingStyle,
  maxVisualPercentOverride: number | undefined,
): RepoNodeSizeTrackingState | null {
  if (!node.sizeTracking?.enabled) {
    return null
  }

  const normalizationMaxLines = node.sizeTracking.normalizationMaxLines
  const ratio =
    normalizationMaxLines > 0
      ? clampNumber(currentLineCount / normalizationMaxLines, 0, 1)
      : 0
  const maxVisualPercent = clampTrackedNodeVisualPercent(
    maxVisualPercentOverride ?? node.sizeTracking.maxVisualPercent,
  )
  const visualPercentRatio = maxVisualPercent / 100
  const growthIntensity = clampNumber(ratio * visualPercentRatio, 0, Math.max(1.2, visualPercentRatio))
  const rowHeightRem =
    sizeTrackingStyle.baseRowHeightRem +
    growthIntensity * sizeTrackingStyle.maxExtraHeightRem
  const fontSizeRem =
    sizeTrackingStyle.baseFontSizeRem +
    growthIntensity * sizeTrackingStyle.maxExtraFontSizeRem

  return {
    enabled: true,
    ratio,
    growthIntensity,
    maxVisualPercent,
    visualPercentRatio,
    normalizationMaxLines,
    rowHeightRem,
    fontSizeRem,
  }
}

function deriveRepoNodeActivityFireState(
  node: RepoDisplayNode,
  recentHeatScore: number,
  recentFireHits: number,
  enableActivityFireIndicators: boolean,
  fireTuning: RepoExplorerFireTuningState,
): RepoNodeActivityFireState | null {
  if (!enableActivityFireIndicators || !node.sizeTracking?.enabled) {
    return null
  }

  return {
    heatScore: recentHeatScore,
    recentHits: recentFireHits,
    fireTier: deriveFireTier(recentHeatScore, fireTuning),
  }
}

function applyTimelineUnitToSourceFileState(
  fileState: SourceFileReplayState,
  unit: RepoDisplayTimelineUnit,
): SourceFileReplayState {
  if (unit.type === 'delete') {
    return {
      ...fileState,
      exists: false,
      currentLineCount: 0,
    }
  }

  let nextLineCount = fileState.currentLineCount

  if (unit.afterLineCount !== null) {
    nextLineCount = Math.max(0, unit.afterLineCount)
  } else if (unit.beforeLineCount !== null) {
    nextLineCount = Math.max(0, unit.beforeLineCount + unit.lineDelta)
  } else if (unit.type === 'create' || unit.type === 'copy') {
    nextLineCount = Math.max(0, unit.lineDelta)
  } else {
    nextLineCount = Math.max(0, fileState.currentLineCount + unit.lineDelta)
  }

  return {
    ...fileState,
    exists: true,
    currentLineCount: nextLineCount,
  }
}

function revertTimelineUnitFromSourceFileState(
  fileState: SourceFileReplayState,
  unit: RepoDisplayTimelineUnit,
): SourceFileReplayState {
  if (unit.type === 'create' || unit.type === 'copy') {
    return {
      ...fileState,
      exists: false,
      currentLineCount: 0,
    }
  }

  if (unit.type === 'delete') {
    return {
      ...fileState,
      exists: true,
      currentLineCount: Math.max(0, unit.beforeLineCount ?? 0),
    }
  }

  let previousLineCount = fileState.currentLineCount

  if (unit.beforeLineCount !== null) {
    previousLineCount = Math.max(0, unit.beforeLineCount)
  } else if (unit.afterLineCount !== null) {
    previousLineCount = Math.max(0, unit.afterLineCount - unit.lineDelta)
  } else {
    previousLineCount = Math.max(0, fileState.currentLineCount - unit.lineDelta)
  }

  return {
    ...fileState,
    exists: true,
    currentLineCount: previousLineCount,
  }
}

function calculateDisplayWeightReference(nodes: RepoDisplayNode[]): number {
  const sortedWeights = nodes
    .map((node) => node.visualWeight)
    .sort((left, right) => left - right)

  if (sortedWeights.length === 0) {
    return 1
  }

  const percentileIndex = Math.max(0, Math.ceil(sortedWeights.length * 0.9) - 1)
  const percentileValue = sortedWeights[percentileIndex] ?? sortedWeights.at(-1) ?? 1
  return Math.max(1, percentileValue)
}

function normalizeDisplayVisualWeight(weight: number, reference: number): number {
  const cappedWeight = Math.min(Math.max(weight, 0), reference)
  const rawWeight = Math.sqrt(cappedWeight / reference)
  return clampNumber(rawWeight, 0, 1)
}

function mapVisualSize(weight: number): RepoVisualSize {
  if (weight < 0.2) {
    return 'xs'
  }

  if (weight < 0.4) {
    return 'sm'
  }

  if (weight < 0.6) {
    return 'md'
  }

  if (weight < 0.8) {
    return 'lg'
  }

  return 'xl'
}

function deriveCurrentVisualSize(
  baseVisualSize: RepoVisualSize,
  currentVisualScale: number,
): RepoVisualSize {
  const baseRank = VISUAL_SIZE_RANK[baseVisualSize]
  const scaledRank = clampNumber(
    Math.round(baseRank * currentVisualScale),
    0,
    VISUAL_SIZE_ORDER.length - 1,
  )

  return VISUAL_SIZE_ORDER[scaledRank] ?? 'xs'
}

function selectFeaturedSections(
  visibleNodes: VisibleRepoNode[],
): FeaturedSection[] {
  const visibleChildrenByParent = new Map<string | null, VisibleRepoNode[]>()

  for (const entry of visibleNodes) {
    const parentId = entry.node.parentNodeId
    const siblings = visibleChildrenByParent.get(parentId) ?? []
    siblings.push(entry)
    visibleChildrenByParent.set(parentId, siblings)
  }

  for (const siblings of visibleChildrenByParent.values()) {
    siblings.sort(compareVisibleNodesForCards)
  }

  const sections: FeaturedSection[] = []
  const rootCards = (visibleChildrenByParent.get(null) ?? []).filter(
    (entry) => entry.node.type !== 'folder',
  )

  if (rootCards.length > 0) {
    sections.push({
      id: 'section:workspace',
      title: 'workspace',
      path: '',
      kindLabel: 'Root',
      nodes: rootCards.slice(0, SECTION_CARD_LIMIT),
      totalVisualWeight: rootCards.reduce((sum, entry) => sum + entry.currentVisualWeight, 0),
      visibleNodeCount: rootCards.length,
    })
  }

  const folderCandidates = visibleNodes
    .filter((entry) => entry.node.type === 'folder')
    .map((entry) => {
      const directChildren = visibleChildrenByParent.get(entry.node.id) ?? []

      if (directChildren.length === 0) {
        return null
      }

      const subtreeEntries = collectVisibleSubtreeEntries(
        entry.node.id,
        visibleChildrenByParent,
      )
      const score =
        subtreeEntries.reduce((sum, childEntry) => sum + childEntry.currentVisualWeight, 0) *
        (entry.node.depth === 0 ? 1.08 : entry.node.depth === 1 ? 1 : 0.92)

      return {
        entry,
        directChildren,
        subtreeEntries,
        score,
      }
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.subtreeEntries.length - left.subtreeEntries.length ||
        left.entry.node.path.localeCompare(right.entry.node.path),
    )

  for (const candidate of folderCandidates) {
    if (
      sections.some(
        (section) =>
          section.path.length > 0 &&
          (isAncestorPath(section.path, candidate.entry.node.path) ||
            isAncestorPath(candidate.entry.node.path, section.path)),
      )
    ) {
      continue
    }

    sections.push({
      id: `section:${candidate.entry.node.id}`,
      title: candidate.entry.node.path,
      path: candidate.entry.node.path,
      kindLabel: 'Folder',
      nodes: candidate.directChildren.slice(0, SECTION_CARD_LIMIT),
      totalVisualWeight: candidate.subtreeEntries.reduce(
        (sum, childEntry) => sum + childEntry.currentVisualWeight,
        0,
      ),
      visibleNodeCount: candidate.subtreeEntries.length,
    })

    if (sections.length === FEATURED_SECTION_LIMIT) {
      break
    }
  }

  if (sections.length < FEATURED_SECTION_LIMIT) {
    const collapsedFallbacks = visibleNodes
      .filter((entry) => entry.node.type === 'collapsedFolder')
      .sort(compareVisibleNodesForCards)

    for (const entry of collapsedFallbacks) {
      if (sections.some((section) => section.path === entry.node.path)) {
        continue
      }

      sections.push({
        id: `section:${entry.node.id}`,
        title: entry.node.path,
        path: entry.node.path,
        kindLabel: 'Collapsed',
        nodes: [entry],
        totalVisualWeight: entry.currentVisualWeight,
        visibleNodeCount: 1,
      })

      if (sections.length === FEATURED_SECTION_LIMIT) {
        break
      }
    }
  }

  return sections
}

function collectVisibleSubtreeEntries(
  nodeId: string,
  visibleChildrenByParent: Map<string | null, VisibleRepoNode[]>,
): VisibleRepoNode[] {
  const collected: VisibleRepoNode[] = []
  const stack = [...(visibleChildrenByParent.get(nodeId) ?? [])]

  while (stack.length > 0) {
    const entry = stack.shift()

    if (!entry) {
      continue
    }

    collected.push(entry)
    const children = visibleChildrenByParent.get(entry.node.id)

    if (children && children.length > 0) {
      stack.unshift(...children)
    }
  }

  return collected
}

function buildExplorerRows(visibleNodes: VisibleRepoNode[]): ExplorerRow[] {
  const childRowsByParent = new Map<string | null, VisibleRepoNode[]>()

  for (const entry of visibleNodes) {
    const rows = childRowsByParent.get(entry.node.parentNodeId) ?? []
    rows.push(entry)
    childRowsByParent.set(entry.node.parentNodeId, rows)
  }

  const flattenedRows: ExplorerRow[] = []

  const appendChildren = (
    parentNodeId: string | null,
    ancestorHasNextSibling: boolean[],
    parentHasNextSibling: boolean | null,
  ) => {
    const rows = childRowsByParent.get(parentNodeId) ?? []

    for (const [index, entry] of rows.entries()) {
      const hasNextSibling = index < rows.length - 1

      flattenedRows.push({
        id: entry.node.id,
        label: entry.node.label,
        path: entry.node.path,
        depth: entry.node.depth,
        type: entry.node.type,
        hiddenChildCount: entry.node.hiddenChildCount,
        hiddenDescendantCount: entry.node.hiddenDescendantCount,
        recentlyChanged: entry.state.recentlyChanged,
        ancestorHasNextSibling,
        hasNextSibling,
        sizeTracking: entry.sizeTracking,
        activityFire: entry.activityFire,
      })

      if (entry.node.type === 'folder') {
        const nextAncestorHasNextSibling =
          entry.node.depth === 0 || parentHasNextSibling === null
            ? ancestorHasNextSibling
            : [...ancestorHasNextSibling, parentHasNextSibling]

        appendChildren(
          entry.node.id,
          nextAncestorHasNextSibling,
          hasNextSibling,
        )
      }
    }
  }

  appendChildren(null, [], null)

  return flattenedRows
}

function countVisibleFolderNodes(visibleNodes: VisibleRepoNode[]) {
  return visibleNodes.filter(
    (entry) =>
      entry.node.type === 'folder' || entry.node.type === 'collapsedFolder',
  ).length
}

function getHottestActivityFireState(
  visibleNodes: VisibleRepoNode[],
): RepoExplorerFireDebugState | null {
  const hottestEntry = visibleNodes
    .filter(
      (entry) =>
        entry.activityFire !== null && entry.activityFire.heatScore > 0,
    )
    .sort((left, right) => {
      const leftFire = left.activityFire
      const rightFire = right.activityFire

      if (!leftFire || !rightFire) {
        return 0
      }

      if (rightFire.heatScore !== leftFire.heatScore) {
        return rightFire.heatScore - leftFire.heatScore
      }

      if (rightFire.recentHits !== leftFire.recentHits) {
        return rightFire.recentHits - leftFire.recentHits
      }

      return left.node.path.localeCompare(right.node.path)
    })
    .at(0)

  if (!hottestEntry?.activityFire) {
    return null
  }

  return {
    nodePath: hottestEntry.node.path,
    nodeLabel: hottestEntry.node.label,
    heatScore: hottestEntry.activityFire.heatScore,
    recentHits: hottestEntry.activityFire.recentHits,
    fireTier: hottestEntry.activityFire.fireTier,
  }
}

function getCardSecondaryLabel(
  entry: VisibleRepoNode,
  sectionPath: string,
) {
  if (entry.node.type === 'file') {
    if (sectionPath === '' || entry.node.path === entry.node.label) {
      return entry.node.path
    }

    if (entry.node.path.startsWith(`${sectionPath}/`)) {
      return entry.node.path.slice(sectionPath.length + 1)
    }

    return entry.node.path
  }

  if (entry.node.type === 'collapsedFolder') {
    return `${formatNumber(entry.node.childCount)} direct children • ${formatNumber(entry.node.hiddenDescendantCount)} hidden files`
  }

  if (entry.node.path === '') {
    return 'workspace'
  }

  return `${formatNumber(entry.node.visibleChildCount)} visible • ${formatNumber(entry.node.hiddenDescendantCount)} hidden`
}

function getCardTertiaryLabel(entry: VisibleRepoNode) {
  if (entry.node.type === 'file') {
    return 'Peak'
  }

  if (entry.node.hiddenDescendantCount > 0) {
    return 'Hidden'
  }

  return 'Children'
}

function compareVisibleNodesForCards(
  left: VisibleRepoNode,
  right: VisibleRepoNode,
) {
  const leftIsFolderLike =
    left.node.type === 'folder' || left.node.type === 'collapsedFolder'
  const rightIsFolderLike =
    right.node.type === 'folder' || right.node.type === 'collapsedFolder'

  if (leftIsFolderLike !== rightIsFolderLike) {
    return leftIsFolderLike ? -1 : 1
  }

  return (
    right.state.currentLineCount - left.state.currentLineCount ||
    right.currentVisualWeight - left.currentVisualWeight ||
    left.node.path.localeCompare(right.node.path)
  )
}

function getTrackedRepoNodeTuningControls(
  model: RepoDisplayModel,
): TrackedRepoNodeTuningControl[] {
  return model.nodes
    .filter((node) => node.sizeTracking?.enabled)
    .map((node) => ({
      path: node.path,
      label: node.path,
      defaultMaxVisualPercent: node.sizeTracking?.maxVisualPercent ?? 100,
    }))
    .sort((left, right) => left.path.localeCompare(right.path))
}

function createDefaultRepoExplorerTuningState(
  model: RepoDisplayModel,
  trackedNodeControls: TrackedRepoNodeTuningControl[],
): RepoExplorerTuningState {
  return {
    sizeTrackingStyle: {
      ...(model.config.sizeTrackingStyle ?? {
        baseRowHeightRem: 1.1,
        maxExtraHeightRem: 2,
        baseFontSizeRem: NORMAL_EXPLORER_FONT_REM,
        maxExtraFontSizeRem: 0.25,
      }),
    },
    fireTuning: createDefaultRepoExplorerFireTuningState(),
    maxVisualPercentByNodePath: Object.fromEntries(
      trackedNodeControls.map((node) => [
        node.path,
        clampTrackedNodeVisualPercent(node.defaultMaxVisualPercent),
      ]),
    ),
  }
}

function loadRepoExplorerTuningState(
  defaultState: RepoExplorerTuningState,
  trackedNodeControls: TrackedRepoNodeTuningControl[],
): RepoExplorerTuningState {
  if (typeof window === 'undefined') {
    return defaultState
  }

  try {
    const rawValue = window.localStorage.getItem(
      REPO_EXPLORER_V2_TUNING_STORAGE_KEY,
    )

    if (!rawValue) {
      return defaultState
    }

    const parsed: unknown = JSON.parse(rawValue)

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return defaultState
    }

    const payload = parsed as RepoExplorerTuningStoragePayload

    return {
      sizeTrackingStyle: {
        baseRowHeightRem: normalizeLoadedSizeTrackingStyleValue(
          'baseRowHeightRem',
          payload.sizeTrackingStyle?.baseRowHeightRem,
          defaultState.sizeTrackingStyle.baseRowHeightRem,
        ),
        maxExtraHeightRem: normalizeLoadedSizeTrackingStyleValue(
          'maxExtraHeightRem',
          payload.sizeTrackingStyle?.maxExtraHeightRem,
          defaultState.sizeTrackingStyle.maxExtraHeightRem,
        ),
        baseFontSizeRem: normalizeLoadedSizeTrackingStyleValue(
          'baseFontSizeRem',
          payload.sizeTrackingStyle?.baseFontSizeRem,
          defaultState.sizeTrackingStyle.baseFontSizeRem,
        ),
        maxExtraFontSizeRem: normalizeLoadedSizeTrackingStyleValue(
          'maxExtraFontSizeRem',
          payload.sizeTrackingStyle?.maxExtraFontSizeRem,
          defaultState.sizeTrackingStyle.maxExtraFontSizeRem,
        ),
      },
      fireTuning: normalizeRepoExplorerFireTuningState({
        fireWindowSize: normalizeLoadedFireTuningValue(
          'fireWindowSize',
          payload.fireTuning?.fireWindowSize,
          defaultState.fireTuning.fireWindowSize,
        ),
        tier1Threshold: normalizeLoadedFireTuningValue(
          'tier1Threshold',
          payload.fireTuning?.tier1Threshold,
          defaultState.fireTuning.tier1Threshold,
        ),
        tier2Threshold: normalizeLoadedFireTuningValue(
          'tier2Threshold',
          payload.fireTuning?.tier2Threshold,
          defaultState.fireTuning.tier2Threshold,
        ),
        tier3Threshold: normalizeLoadedFireTuningValue(
          'tier3Threshold',
          payload.fireTuning?.tier3Threshold,
          defaultState.fireTuning.tier3Threshold,
        ),
        fireSizePx: normalizeLoadedFireTuningValue(
          'fireSizePx',
          payload.fireTuning?.fireSizePx,
          defaultState.fireTuning.fireSizePx,
        ),
      }),
      maxVisualPercentByNodePath: Object.fromEntries(
        trackedNodeControls.map((node) => [
          node.path,
          clampTrackedNodeVisualPercent(
            payload.sizeTrackedNodes?.[node.path]?.maxVisualPercent ??
              defaultState.maxVisualPercentByNodePath[node.path] ??
              node.defaultMaxVisualPercent,
          ),
        ]),
      ),
    }
  } catch {
    return defaultState
  }
}

function serializeRepoExplorerTuningState(
  tuningState: RepoExplorerTuningState,
): RepoExplorerTuningStoragePayload {
  return {
    sizeTrackingStyle: { ...tuningState.sizeTrackingStyle },
    fireTuning: { ...tuningState.fireTuning },
    sizeTrackedNodes: Object.fromEntries(
      Object.entries(tuningState.maxVisualPercentByNodePath).map(
        ([path, maxVisualPercent]) => [
          path,
          { maxVisualPercent: clampTrackedNodeVisualPercent(maxVisualPercent) },
        ],
      ),
    ),
  }
}

function buildRepoExplorerTuningConfigSnippet(
  tuningState: RepoExplorerTuningState,
  trackedNodeControls: TrackedRepoNodeTuningControl[],
) {
  return {
    display: {
      sizeTrackingStyle: {
        ...tuningState.sizeTrackingStyle,
      },
      sizeTrackedNodes: Object.fromEntries(
        trackedNodeControls.map((node) => [
          node.path,
          {
            maxVisualPercent: clampTrackedNodeVisualPercent(
              tuningState.maxVisualPercentByNodePath[node.path] ??
                node.defaultMaxVisualPercent,
            ),
          },
        ]),
      ),
    },
    repoExplorerLive: {
      fireTuning: {
        ...tuningState.fireTuning,
      },
    },
  }
}

function createDefaultRepoExplorerFireTuningState(): RepoExplorerFireTuningState {
  return {
    fireWindowSize: DEFAULT_FIRE_WINDOW_SIZE,
    tier1Threshold: DEFAULT_FIRE_TIER_ONE_THRESHOLD,
    tier2Threshold: DEFAULT_FIRE_TIER_TWO_THRESHOLD,
    tier3Threshold: DEFAULT_FIRE_TIER_THREE_THRESHOLD,
    fireSizePx: DEFAULT_FIRE_SIZE_PX,
  }
}

function normalizeRepoExplorerFireTuningState(
  fireTuning: RepoExplorerFireTuningState,
): RepoExplorerFireTuningState {
  const fireWindowSize = clampFireTuningValue(
    'fireWindowSize',
    fireTuning.fireWindowSize,
  )
  const fireSizePx = clampFireTuningValue('fireSizePx', fireTuning.fireSizePx)
  const tier1Threshold = clampFireTuningValue(
    'tier1Threshold',
    fireTuning.tier1Threshold,
  )
  const tier2Threshold = clampNumber(
    clampFireTuningValue('tier2Threshold', fireTuning.tier2Threshold),
    tier1Threshold,
    FIRE_TUNING_RANGES.tier2Threshold.max,
  )
  const tier3Threshold = clampNumber(
    clampFireTuningValue('tier3Threshold', fireTuning.tier3Threshold),
    tier2Threshold,
    FIRE_TUNING_RANGES.tier3Threshold.max,
  )

  return {
    fireWindowSize,
    tier1Threshold,
    tier2Threshold,
    tier3Threshold,
    fireSizePx,
  }
}

function normalizeLoadedSizeTrackingStyleValue(
  key: keyof RepoDisplaySizeTrackingStyle,
  rawValue: number | undefined,
  defaultValue: number,
) {
  return typeof rawValue === 'number' && Number.isFinite(rawValue)
    ? clampSizeTrackingStyleValue(key, rawValue)
    : defaultValue
}

function normalizeLoadedFireTuningValue(
  key: keyof RepoExplorerFireTuningState,
  rawValue: number | undefined,
  defaultValue: number,
) {
  return typeof rawValue === 'number' && Number.isFinite(rawValue)
    ? clampFireTuningValue(key, rawValue)
    : defaultValue
}

function clampSizeTrackingStyleValue(
  key: keyof RepoDisplaySizeTrackingStyle,
  value: number,
) {
  const range = SIZE_TRACKING_STYLE_RANGES[key]

  return clampNumber(value, range.min, range.max)
}

function clampFireTuningValue(
  key: keyof RepoExplorerFireTuningState,
  value: number,
) {
  const range = FIRE_TUNING_RANGES[key]

  return roundToStep(clampNumber(value, range.min, range.max), range.step)
}

function clampTrackedNodeVisualPercent(value: number) {
  return roundToStep(
    clampNumber(
      value,
      MAX_VISUAL_PERCENT_RANGE.min,
      MAX_VISUAL_PERCENT_RANGE.max,
    ),
    MAX_VISUAL_PERCENT_RANGE.step,
  )
}

function roundToStep(value: number, step: number) {
  if (step <= 0) {
    return value
  }

  return Math.round(value / step) * step
}

async function copyTextToClipboard(text: string) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }

    if (typeof document === 'undefined') {
      return false
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()

    const didCopy = document.execCommand('copy')
    document.body.removeChild(textarea)

    return didCopy
  } catch {
    return false
  }
}

function formatTuningValue(value: number, decimals: number) {
  return Number.parseFloat(value.toFixed(decimals)).toString()
}

function formatPlaybackSpeed(speed: PlaybackSpeed) {
  return `${speed}x`
}

function formatDurationPreset(durationSeconds: PlaybackDurationSeconds) {
  return `${durationSeconds}s`
}

function formatDurationSeconds(durationSeconds: number) {
  if (durationSeconds <= 0) {
    return '0s'
  }

  if (durationSeconds < 10) {
    return `${durationSeconds.toFixed(1)}s`
  }

  return `${Math.round(durationSeconds)}s`
}

function isAncestorPath(leftPath: string, rightPath: string) {
  return rightPath.startsWith(`${leftPath}/`)
}

function deriveFireTier(
  heatScore: number,
  fireTuning: RepoExplorerFireTuningState,
): 0 | 1 | 2 | 3 {
  if (heatScore >= fireTuning.tier3Threshold) {
    return 3
  }

  if (heatScore >= fireTuning.tier2Threshold) {
    return 2
  }

  if (heatScore >= fireTuning.tier1Threshold) {
    return 1
  }

  return 0
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}
