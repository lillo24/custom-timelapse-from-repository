import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react'
import { PresentationStage } from '../components/presentation/PresentationStage'
import { useRepoVisualModel } from '../hooks/useRepoVisualModel'
import {
  getFadeSlideSide,
  getFadeSlideUp,
  getScaleFade,
  getStaggerDelay,
  springSoft,
} from '../lib/motionPresets'
import type {
  RepoVisualModel,
  VisualFile,
  VisualFileSize,
  VisualFolder,
  VisualTimelineUnit,
} from '../preprocessing/visualModelTypes'

type PlaybackSpeed = (typeof PLAYBACK_SPEED_OPTIONS)[number]

type CurrentRepoFileState = {
  path: string
  exists: boolean
  currentLineCount: number
  maxLineCount: number
  finalLineCount: number
  recentlyChanged: boolean
}

type VisibleRepoFile = {
  file: VisualFile
  state: CurrentRepoFileState
  currentVisualScale: number
  currentVisualSize: VisualFileSize
  currentVisualWeight: number
  highlightStrength: number
}

type FeaturedFolder = {
  folder: VisualFolder
  files: VisibleRepoFile[]
  totalVisualWeight: number
  visibleFileCount: number
}

type SidebarChild = {
  folder: VisualFolder
  visibleFileCount: number
}

type SidebarNode = {
  folder: VisualFolder
  children: SidebarChild[]
  totalVisualWeight: number
  visibleFileCount: number
}

type RepoProgressState = {
  activeUnit: VisualTimelineUnit | null
  visibleFiles: VisibleRepoFile[]
  recentTouchedCount: number
}

const PLAYBACK_SPEED_OPTIONS = [0.5, 1, 2, 4] as const
const BASE_UNITS_PER_SECOND = 36
const RECENT_UNIT_WINDOW = 20

const CATEGORY_STYLES: Record<
  string,
  {
    badge: string
    glow: string
    label: string
  }
> = {
  ui: {
    badge:
      'border-cyan-400/25 bg-cyan-400/12 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.04)]',
    glow: 'from-cyan-300/45 via-cyan-400/12 to-transparent',
    label: 'UI',
  },
  source: {
    badge:
      'border-emerald-400/25 bg-emerald-400/12 text-emerald-100 shadow-[0_0_0_1px_rgba(16,185,129,0.04)]',
    glow: 'from-emerald-300/45 via-emerald-400/12 to-transparent',
    label: 'Source',
  },
  backend: {
    badge:
      'border-sky-400/25 bg-sky-400/12 text-sky-100 shadow-[0_0_0_1px_rgba(56,189,248,0.04)]',
    glow: 'from-sky-300/45 via-sky-400/12 to-transparent',
    label: 'Backend',
  },
  test: {
    badge:
      'border-amber-400/25 bg-amber-400/12 text-amber-100 shadow-[0_0_0_1px_rgba(245,158,11,0.04)]',
    glow: 'from-amber-300/45 via-amber-400/12 to-transparent',
    label: 'Tests',
  },
  docs: {
    badge:
      'border-violet-400/25 bg-violet-400/12 text-violet-100 shadow-[0_0_0_1px_rgba(167,139,250,0.04)]',
    glow: 'from-violet-300/45 via-violet-400/12 to-transparent',
    label: 'Docs',
  },
  config: {
    badge:
      'border-rose-400/25 bg-rose-400/12 text-rose-100 shadow-[0_0_0_1px_rgba(251,113,133,0.04)]',
    glow: 'from-rose-300/45 via-rose-400/12 to-transparent',
    label: 'Config',
  },
  data: {
    badge:
      'border-fuchsia-400/25 bg-fuchsia-400/12 text-fuchsia-100 shadow-[0_0_0_1px_rgba(217,70,239,0.04)]',
    glow: 'from-fuchsia-300/45 via-fuchsia-400/12 to-transparent',
    label: 'Data',
  },
  script: {
    badge:
      'border-orange-400/25 bg-orange-400/12 text-orange-100 shadow-[0_0_0_1px_rgba(251,146,60,0.04)]',
    glow: 'from-orange-300/45 via-orange-400/12 to-transparent',
    label: 'Scripts',
  },
  unknown: {
    badge:
      'border-slate-400/25 bg-slate-400/10 text-slate-200 shadow-[0_0_0_1px_rgba(148,163,184,0.04)]',
    glow: 'from-slate-200/35 via-slate-300/10 to-transparent',
    label: 'Files',
  },
}

const FILE_SIZE_LAYOUT: Record<
  VisualFileSize,
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

const SIZE_LABELS: Record<VisualFileSize, string> = {
  xs: 'Pocket',
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
  xl: 'Anchor',
}

const VISUAL_SIZE_ORDER: VisualFileSize[] = ['xs', 'sm', 'md', 'lg', 'xl']

const VISUAL_SIZE_RANK: Record<VisualFileSize, number> = {
  xs: 0,
  sm: 1,
  md: 2,
  lg: 3,
  xl: 4,
}

export function RepoExplorerScene() {
  const shouldReduceMotion = useReducedMotion() ?? false
  const overlayMotion = getFadeSlideUp(shouldReduceMotion, 10)
  const { model, error, isLoading } = useRepoVisualModel()

  return (
    <main className="flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.14),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.12),transparent_28%),linear-gradient(180deg,#020617_0%,#02030a_100%)] p-4 text-slate-50 sm:p-5 lg:p-6">
      <div className="flex h-full w-full items-center justify-center">
        <PresentationStage>
          <div className="relative h-full overflow-hidden bg-[linear-gradient(160deg,rgba(8,15,32,0.98),rgba(3,7,18,0.98))]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.1),transparent_28%),radial-gradient(circle_at_82%_16%,rgba(251,191,36,0.08),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_30%)]" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            <motion.div
              initial={overlayMotion.initial}
              animate={overlayMotion.animate}
              transition={springSoft}
              className="relative flex h-full flex-col gap-4 p-5 sm:p-6"
            >
              {isLoading ? (
                <RepoExplorerSkeleton />
              ) : error ? (
                <RepoExplorerError message={error} />
              ) : model ? (
                <RepoExplorerCanvas
                  model={model}
                  shouldReduceMotion={shouldReduceMotion}
                />
              ) : (
                <RepoExplorerError message="Repository model did not load." />
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
}: {
  model: RepoVisualModel
  shouldReduceMotion: boolean
}) {
  const headerMotion = getFadeSlideUp(shouldReduceMotion, 12)
  const panelMotion = getFadeSlideSide(shouldReduceMotion, 16)
  const sectionPresenceMotion = getFadeSlideUp(shouldReduceMotion, 8)
  const maxUnitIndex = Math.max(model.timeline.length - 1, 0)
  const [activeUnitIndex, setActiveUnitIndex] = useState(maxUnitIndex)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1)
  const clampedActiveUnitIndex = clampNumber(activeUnitIndex, 0, maxUnitIndex)
  const currentUnitIndexRef = useRef(clampedActiveUnitIndex)
  const playbackCarryRef = useRef(0)
  const lastAnimationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    currentUnitIndexRef.current = clampedActiveUnitIndex
  }, [clampedActiveUnitIndex])

  useEffect(() => {
    if (model.timeline.length === 0 && isPlaying) {
      setIsPlaying(false)
    }
  }, [isPlaying, model.timeline.length])

  useEffect(() => {
    if (isPlaying && clampedActiveUnitIndex >= maxUnitIndex) {
      setIsPlaying(false)
    }
  }, [clampedActiveUnitIndex, isPlaying, maxUnitIndex])

  function updateActiveUnitIndex(nextIndex: number) {
    const clampedIndex = clampNumber(nextIndex, 0, maxUnitIndex)
    currentUnitIndexRef.current = clampedIndex
    startTransition(() => {
      setActiveUnitIndex(clampedIndex)
    })
  }

  const advancePlaybackFrame = useEffectEvent((timestamp: number) => {
    if (!isPlaying || model.timeline.length === 0) {
      return
    }

    if (lastAnimationFrameRef.current === null) {
      lastAnimationFrameRef.current = timestamp
      return
    }

    const elapsedMs = timestamp - lastAnimationFrameRef.current
    lastAnimationFrameRef.current = timestamp

    const pendingUnits =
      playbackCarryRef.current +
      (elapsedMs / 1000) * BASE_UNITS_PER_SECOND * playbackSpeed
    const unitsToAdvance = Math.floor(pendingUnits)
    playbackCarryRef.current = pendingUnits - unitsToAdvance

    if (unitsToAdvance < 1) {
      return
    }

    const nextIndex = Math.min(
      maxUnitIndex,
      currentUnitIndexRef.current + unitsToAdvance,
    )

    if (nextIndex !== currentUnitIndexRef.current) {
      updateActiveUnitIndex(nextIndex)
    }

    if (nextIndex >= maxUnitIndex) {
      playbackCarryRef.current = 0
      lastAnimationFrameRef.current = null
      setIsPlaying(false)
    }
  })

  useEffect(() => {
    if (!isPlaying || model.timeline.length === 0) {
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
  }, [advancePlaybackFrame, isPlaying, model.timeline.length, playbackSpeed])

  function handleTogglePlayback() {
    if (model.timeline.length === 0) {
      return
    }

    if (isPlaying) {
      setIsPlaying(false)
      return
    }

    if (clampedActiveUnitIndex >= maxUnitIndex) {
      updateActiveUnitIndex(0)
    }

    setIsPlaying(true)
  }

  const progressState = buildRepoProgressState(model, clampedActiveUnitIndex)
  const activeUnit = progressState.activeUnit
  const visibleFiles = progressState.visibleFiles
  const featuredFolders = selectFeaturedFolders(model.folders, visibleFiles)
  const sidebarNodes = buildSidebarNodes(model.folders, visibleFiles)
  const rootFiles = visibleFiles
    .filter((entry) => entry.file.folderPath === '')
    .sort(
      (left, right) =>
        right.currentVisualWeight - left.currentVisualWeight ||
        right.state.currentLineCount - left.state.currentLineCount ||
        left.file.path.localeCompare(right.file.path),
    )
    .slice(0, 4)
  const largestFiles = [...visibleFiles]
    .sort(
      (left, right) =>
        right.state.currentLineCount - left.state.currentLineCount ||
        right.currentVisualWeight - left.currentVisualWeight ||
        left.file.path.localeCompare(right.file.path),
    )
    .slice(0, 5)
  const visibleWeightTotal = Math.max(
    visibleFiles.reduce((sum, entry) => sum + entry.currentVisualWeight, 0),
    1,
  )
  const canStepBackward = model.timeline.length > 0 && clampedActiveUnitIndex > 0
  const canStepForward =
    model.timeline.length > 0 && clampedActiveUnitIndex < maxUnitIndex
  const activeUnitLabel =
    model.timeline.length > 0
      ? `Unit ${formatNumber(clampedActiveUnitIndex + 1)} / ${formatNumber(model.timeline.length)}`
      : 'No timeline units'
  const activeOrderLabel = activeUnit
    ? `Order ${formatNumber(activeUnit.unitOrder)}`
    : 'Static fallback'

  return (
    <>
      <FloatingInspectorPanel
        largestFiles={largestFiles}
        warnings={model.warnings}
        shouldReduceMotion={shouldReduceMotion}
      />

      <motion.section
        initial={headerMotion.initial}
        animate={headerMotion.animate}
        transition={{ ...springSoft, delay: getStaggerDelay(1, 0.04) }}
        className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,30,0.94),rgba(4,8,18,0.96))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div className="min-w-0 xl:min-w-[272px]">
            <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
              Timeline position
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-teal-400/20 bg-teal-400/10 px-3 py-1 font-mono text-[11px] text-teal-100">
                {activeUnitLabel}
              </span>
              <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[11px] text-slate-300">
                {activeOrderLabel}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[11px] text-slate-300">
                {isPlaying ? 'Playing' : 'Paused'} {formatPlaybackSpeed(playbackSpeed)}
              </span>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <input
              type="range"
              min={0}
              max={maxUnitIndex}
              step={1}
              value={clampedActiveUnitIndex}
              onChange={(event) => {
                updateActiveUnitIndex(Number.parseInt(event.target.value, 10))
              }}
              disabled={model.timeline.length === 0}
              aria-label="Repository timeline position"
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-teal-400 disabled:cursor-not-allowed disabled:opacity-40"
            />

            <div className="mt-2 flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.24em] text-slate-500">
              <span>Start</span>
              <span>Recent pulse window: {RECENT_UNIT_WINDOW} units</span>
              <span>Current</span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 xl:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <ControlButton
                label={isPlaying ? 'Pause' : 'Play'}
                onClick={handleTogglePlayback}
                disabled={model.timeline.length === 0}
                isPrimary
              />
              <ControlButton
                label="Reset"
                onClick={() => {
                  updateActiveUnitIndex(0)
                }}
                disabled={model.timeline.length === 0 || clampedActiveUnitIndex === 0}
              />
              <ControlButton
                label="Previous"
                onClick={() => {
                  updateActiveUnitIndex(clampedActiveUnitIndex - 1)
                }}
                disabled={!canStepBackward}
              />
              <ControlButton
                label="Next"
                onClick={() => {
                  updateActiveUnitIndex(clampedActiveUnitIndex + 1)
                }}
                disabled={!canStepForward}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {PLAYBACK_SPEED_OPTIONS.map((speed) => (
                <SpeedButton
                  key={speed}
                  speed={speed}
                  isActive={playbackSpeed === speed}
                  onClick={() => {
                    setPlaybackSpeed(speed)
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[248px_minmax(0,1fr)]">
        <motion.aside
          initial={panelMotion.initial}
          animate={panelMotion.animate}
          transition={{ ...springSoft, delay: getStaggerDelay(2, 0.06) }}
          className="min-h-0 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,28,0.94),rgba(4,8,18,0.94))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        >
          <div className="flex h-full flex-col gap-4">
            <PanelHeader
              title="Project tree"
              subtitle="Top-level folders and their strongest branches"
            />

            <div className="rounded-[20px] border border-white/8 bg-slate-950/55 px-3 py-3">
              <div className="flex items-center justify-between gap-3 text-sm text-slate-200">
                <span className="font-medium">workspace</span>
                <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  root
                </span>
              </div>

              {rootFiles.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {rootFiles.map((entry) => (
                    <span
                      key={entry.file.id}
                      className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300"
                    >
                      {entry.file.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-[12px] leading-5 text-slate-500">
                  Root files will appear as the timeline advances.
                </p>
              )}
            </div>

            <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
              {sidebarNodes.length > 0 ? (
                sidebarNodes.map((node) => (
                  <div
                    key={node.folder.id}
                    className="rounded-[22px] border border-white/8 bg-white/[0.02] px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-100">
                          {node.folder.name}
                        </div>
                        <div className="mt-1 truncate font-mono text-[11px] text-slate-500">
                          {node.folder.path}
                        </div>
                      </div>
                      <div className="rounded-full border border-white/10 px-2 py-1 font-mono text-[10px] text-slate-400">
                        {formatNumber(node.visibleFileCount)}
                      </div>
                    </div>

                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800/90">
                      <motion.div
                        className="h-full rounded-full bg-[linear-gradient(90deg,rgba(45,212,191,0.9),rgba(56,189,248,0.75))]"
                        animate={{
                          width: `${Math.max(16, Math.min(100, (node.totalVisualWeight / visibleWeightTotal) * 100))}%`,
                        }}
                        transition={{ duration: 0.28, ease: 'easeOut' }}
                      />
                    </div>

                    {node.children.length > 0 ? (
                      <div className="mt-3 space-y-2 border-l border-white/6 pl-3">
                        {node.children.map((child) => (
                          <div
                            key={child.folder.id}
                            className="flex items-center justify-between gap-3 text-[12px] text-slate-300"
                          >
                            <span className="truncate">{child.folder.name}</span>
                            <span className="font-mono text-[10px] text-slate-500">
                              {formatNumber(child.visibleFileCount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <EmptyPanelState message="No folders are visible at the current timeline position." />
              )}
            </div>
          </div>
        </motion.aside>

        <motion.section
          initial={panelMotion.initial}
          animate={panelMotion.animate}
          transition={{ ...springSoft, delay: getStaggerDelay(3, 0.06) }}
          className="min-h-0 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(7,12,24,0.92),rgba(4,8,18,0.94))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        >
          <div className="flex h-full flex-col gap-4">
            <PanelHeader
              title="Explorer clusters"
              subtitle="Folders grouped as repository neighborhoods"
            />

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto pr-1 2xl:grid-cols-2">
              <AnimatePresence initial={false}>
                {featuredFolders.length > 0 ? (
                  featuredFolders.map((section, index) => (
                    <motion.article
                      key={section.folder.id}
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
                              Folder
                            </span>
                            <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                              {formatNumber(section.visibleFileCount)} files
                            </span>
                          </div>
                          <h2 className="mt-2 truncate font-display text-xl tracking-[-0.04em] text-white">
                            {section.folder.path}
                          </h2>
                          <p className="mt-1 text-[12px] leading-5 text-slate-400">
                            {formatNumber(section.files.length)} visible cards /{' '}
                            {section.files[0] ? section.files[0].file.category : 'files'}-heavy
                            subtree
                          </p>
                        </div>

                        <span className="rounded-full border border-teal-400/20 bg-teal-400/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-teal-100">
                          {section.totalVisualWeight.toFixed(1)} weight
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-4 gap-3 xl:grid-cols-5">
                        <AnimatePresence initial={false} mode="popLayout">
                          {section.files.map((entry) => (
                            <RepoFileCard
                              key={entry.file.id}
                              entry={entry}
                              folderPath={section.folder.path}
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
                    No repository files are visible at the selected position yet.
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
}: {
  label: string
  onClick: () => void
  disabled: boolean
  isPrimary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
        isPrimary
          ? 'border-teal-300/25 bg-teal-300/14 text-teal-50 hover:bg-teal-300/18'
          : 'border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]'
      }`}
    >
      {label}
    </button>
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

function FloatingInspectorPanel({
  largestFiles,
  warnings,
  shouldReduceMotion,
}: {
  largestFiles: VisibleRepoFile[]
  warnings: string[]
  shouldReduceMotion: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const presenceMotion = getScaleFade(shouldReduceMotion)

  return (
    <div className="pointer-events-none absolute right-5 top-5 z-20 sm:right-6 sm:top-6">
      <div className="pointer-events-auto flex w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col items-end gap-2">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls="repo-inspector-panel"
          onClick={() => {
            setIsOpen((current) => !current)
          }}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/80 px-4 py-2 text-sm text-slate-100 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:bg-slate-900/85"
        >
          <span>Inspector</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400">
            {isOpen ? 'Hide' : 'Show'}
          </span>
        </button>

        <AnimatePresence initial={false}>
          {isOpen ? (
            <motion.aside
              id="repo-inspector-panel"
              initial={presenceMotion.initial}
              animate={presenceMotion.animate}
              exit={presenceMotion.exit}
              transition={springSoft}
              className="max-h-[70vh] w-full overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,28,0.96),rgba(4,8,18,0.96))] shadow-[0_28px_90px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md"
            >
              <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
                <PanelHeader
                  title="Inspector"
                  subtitle="Current file state plus temporary motion emphasis"
                />

                <div className="rounded-[22px] border border-teal-400/15 bg-teal-400/[0.05] p-4">
                  <div className="text-[11px] uppercase tracking-[0.26em] text-teal-100/80">
                    Size basis
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    Card geometry follows the current line count replayed from the
                    timeline. Recent edits only change pulse, glow, and timing
                    emphasis, never permanent width or height.
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {(Object.keys(SIZE_LABELS) as VisualFileSize[]).map((size) => (
                      <div
                        key={size}
                        className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2"
                      >
                        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-slate-500">
                          {size}
                        </div>
                        <div className="mt-1 text-sm text-slate-100">
                          {SIZE_LABELS[size]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[22px] border border-white/8 bg-white/[0.02] p-4">
                  <div className="text-[11px] uppercase tracking-[0.26em] text-slate-500">
                    Largest current files
                  </div>
                  <div className="mt-3 space-y-3">
                    {largestFiles.length > 0 ? (
                      largestFiles.map((entry) => {
                        const categoryStyle =
                          CATEGORY_STYLES[entry.file.category] ?? CATEGORY_STYLES.unknown

                        return (
                          <div
                            key={entry.file.id}
                            className="rounded-[18px] border border-white/6 bg-slate-950/50 px-3 py-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] ${categoryStyle.badge}`}
                              >
                                {categoryStyle.label}
                              </span>
                              <span className="font-mono text-[11px] text-slate-500">
                                {formatNumber(entry.state.currentLineCount)} current
                              </span>
                            </div>
                            <div className="mt-2 text-sm font-medium text-slate-100">
                              {entry.file.name}
                            </div>
                            <div className="mt-1 truncate font-mono text-[11px] text-slate-500">
                              {entry.file.path}
                            </div>
                            <div className="mt-2 text-[11px] uppercase tracking-[0.22em] text-slate-400">
                              Peak {formatNumber(entry.file.maxLineCount)} / Final{' '}
                              {formatNumber(entry.file.finalLineCount)}
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <EmptyPanelState message="Visible file details will appear as the timeline advances." />
                    )}
                  </div>
                </div>

                <div className="rounded-[22px] border border-white/8 bg-white/[0.02] p-4">
                  <div className="text-[11px] uppercase tracking-[0.26em] text-slate-500">
                    Model warnings
                  </div>
                  <div className="mt-3 space-y-2 text-[13px] leading-5 text-slate-300">
                    {warnings.length > 0 ? (
                      warnings.slice(0, 4).map((warning) => (
                        <div
                          key={warning}
                          className="rounded-[16px] border border-amber-400/15 bg-amber-400/[0.05] px-3 py-2.5 text-amber-50/90"
                        >
                          {warning}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[16px] border border-emerald-400/15 bg-emerald-400/[0.05] px-3 py-2.5 text-emerald-50/90">
                        No structural model warnings.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.aside>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}

function RepoFileCard({
  entry,
  folderPath,
  shouldReduceMotion,
}: {
  entry: VisibleRepoFile
  folderPath: string
  shouldReduceMotion: boolean
}) {
  const { file, state, currentVisualScale, currentVisualSize, highlightStrength } = entry
  const layout = FILE_SIZE_LAYOUT[currentVisualSize]
  const categoryStyle = CATEGORY_STYLES[file.category] ?? CATEGORY_STYLES.unknown
  const relativeFolder =
    folderPath === '' || file.folderPath === folderPath
      ? file.name
      : file.path.slice(folderPath.length + 1)
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

  // Keep geometry tied to replayed current line state; recent activity only
  // affects temporary emphasis such as pulse, glow, and contrast.
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
        className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${categoryStyle.glow}`}
      />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate font-display text-[15px] font-medium tracking-[-0.03em] text-white">
                {file.name}
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
              {relativeFolder}
            </div>
          </div>

          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] ${categoryStyle.badge}`}
          >
            {file.extension ?? 'file'}
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
              Peak
            </div>
            <div className="mt-1 text-slate-200">
              {formatNumber(file.maxLineCount)}
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  )
}

function PanelHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
        {title}
      </div>
      <div className="text-sm text-slate-300">
        {subtitle}
      </div>
    </div>
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
      <div className="space-y-4">
        <div className="h-7 w-56 rounded-full bg-white/8" />
        <div className="h-14 w-[28rem] max-w-full rounded-[24px] bg-white/6" />
      </div>

      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-col gap-4 xl:flex-row">
          <div className="h-16 rounded-[18px] bg-white/[0.04] xl:w-72" />
          <div className="h-16 flex-1 rounded-[18px] bg-white/[0.04]" />
          <div className="h-16 rounded-[18px] bg-white/[0.04] xl:w-60" />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[248px_minmax(0,1fr)_272px]">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-20 rounded-[22px] bg-white/[0.04]"
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

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-28 rounded-[22px] bg-white/[0.04]"
              />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function RepoExplorerError({
  message,
}: {
  message: string
}) {
  return (
    <div className="grid flex-1 place-items-center">
      <div className="max-w-xl rounded-[28px] border border-rose-400/20 bg-rose-400/[0.06] p-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="text-[11px] uppercase tracking-[0.28em] text-rose-100/80">
          Repository scene unavailable
        </div>
        <h1 className="mt-4 font-display text-3xl tracking-[-0.04em] text-white">
          The visual model could not be loaded.
        </h1>
        <p className="mt-4 text-sm leading-6 text-rose-50/90">
          {message}
        </p>
        <p className="mt-3 text-sm leading-6 text-rose-50/70">
          Re-run the preprocessing pipeline so{' '}
          <code className="rounded bg-black/20 px-1.5 py-0.5 text-[13px]">
            public/data/repo-visual-model.json
          </code>{' '}
          is refreshed for the app.
        </p>
      </div>
    </div>
  )
}

function buildRepoProgressState(
  model: RepoVisualModel,
  activeUnitIndex: number,
): RepoProgressState {
  const fileStateById = new Map<string, CurrentRepoFileState>()

  for (const file of model.files) {
    fileStateById.set(file.id, {
      path: file.path,
      exists: model.timeline.length === 0,
      currentLineCount: model.timeline.length === 0 ? file.finalLineCount : 0,
      maxLineCount: file.maxLineCount,
      finalLineCount: file.finalLineCount,
      recentlyChanged: false,
    })
  }

  if (model.timeline.length === 0) {
    return {
      activeUnit: null,
      visibleFiles: model.files
        .map((file) => createVisibleRepoFile(file, fileStateById.get(file.id), 0))
        .filter((entry): entry is VisibleRepoFile => entry !== null),
      recentTouchedCount: 0,
    }
  }

  const clampedActiveUnitIndex = clampNumber(
    activeUnitIndex,
    0,
    model.timeline.length - 1,
  )
  const activeUnit = model.timeline[clampedActiveUnitIndex] ?? null

  if (!activeUnit) {
    return {
      activeUnit: null,
      visibleFiles: [],
      recentTouchedCount: 0,
    }
  }

  for (let index = 0; index <= clampedActiveUnitIndex; index += 1) {
    const unit = model.timeline[index]

    if (!unit) {
      continue
    }

    const currentFileState = fileStateById.get(unit.fileId)

    if (!currentFileState) {
      continue
    }

    fileStateById.set(unit.fileId, applyTimelineUnitToFileState(currentFileState, unit))
  }

  const recentActivityByFileId = new Map<string, number>()
  const recentUnitStartIndex = Math.max(
    0,
    clampedActiveUnitIndex - (RECENT_UNIT_WINDOW - 1),
  )

  for (let index = recentUnitStartIndex; index <= clampedActiveUnitIndex; index += 1) {
    const unit = model.timeline[index]

    if (!unit) {
      continue
    }

    const distance = clampedActiveUnitIndex - index
    const recencyFactor = 1 - (distance / RECENT_UNIT_WINDOW) * 0.55
    const intensity = clampNumber(unit.activityWeight * recencyFactor, 0, 1)
    const previousIntensity = recentActivityByFileId.get(unit.fileId) ?? 0

    if (intensity > previousIntensity) {
      recentActivityByFileId.set(unit.fileId, intensity)
    }
  }

  for (const [fileId, intensity] of recentActivityByFileId.entries()) {
    const currentFileState = fileStateById.get(fileId)

    if (!currentFileState || !currentFileState.exists || intensity <= 0) {
      continue
    }

    fileStateById.set(fileId, {
      ...currentFileState,
      recentlyChanged: true,
    })
  }

  return {
    activeUnit,
    visibleFiles: model.files
      .map((file) =>
        createVisibleRepoFile(
          file,
          fileStateById.get(file.id),
          recentActivityByFileId.get(file.id) ?? 0,
        ),
      )
      .filter((entry): entry is VisibleRepoFile => entry !== null),
    recentTouchedCount: recentActivityByFileId.size,
  }
}

function applyTimelineUnitToFileState(
  fileState: CurrentRepoFileState,
  unit: VisualTimelineUnit,
): CurrentRepoFileState {
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

  // TODO: If the visual model later includes previous file ids for renames,
  // replay that explicitly instead of relying on target-file continuity alone.
  return {
    ...fileState,
    exists: true,
    currentLineCount: nextLineCount,
  }
}

function createVisibleRepoFile(
  file: VisualFile,
  fileState: CurrentRepoFileState | undefined,
  highlightStrength: number,
): VisibleRepoFile | null {
  if (!fileState || !fileState.exists) {
    return null
  }

  const ratio =
    fileState.maxLineCount > 0
      ? clampNumber(fileState.currentLineCount / fileState.maxLineCount, 0, 1)
      : 0
  const currentVisualScale = clampNumber(0.45 + Math.sqrt(ratio) * 0.75, 0.45, 1.2)
  const currentVisualSize = deriveCurrentVisualSize(file.visualSize, currentVisualScale)
  const currentVisualWeight = Math.max(0.06, file.visualWeight * currentVisualScale)

  return {
    file,
    state: fileState,
    currentVisualScale,
    currentVisualSize,
    currentVisualWeight,
    highlightStrength,
  }
}

function deriveCurrentVisualSize(
  baseVisualSize: VisualFileSize,
  currentVisualScale: number,
): VisualFileSize {
  const baseRank = VISUAL_SIZE_RANK[baseVisualSize]
  const scaledRank = clampNumber(
    Math.round(baseRank * currentVisualScale),
    0,
    VISUAL_SIZE_ORDER.length - 1,
  )

  return VISUAL_SIZE_ORDER[scaledRank] ?? 'xs'
}

function selectFeaturedFolders(
  folders: VisualFolder[],
  visibleFiles: VisibleRepoFile[],
): FeaturedFolder[] {
  const candidates = folders
    .filter((folder) => folder.path !== '')
    .map((folder) => {
      const subtreeFiles = getVisibleFilesInSubtree(visibleFiles, folder.path).sort(
        (left, right) =>
          right.currentVisualWeight - left.currentVisualWeight ||
          right.state.currentLineCount - left.state.currentLineCount ||
          left.file.path.localeCompare(right.file.path),
      )

      const totalVisualWeight = subtreeFiles.reduce(
        (sum, entry) => sum + entry.currentVisualWeight,
        0,
      )
      const visibleFileCount = subtreeFiles.length
      const score =
        totalVisualWeight *
        (folder.depth === 2 ? 1.08 : folder.depth === 1 ? 1 : 0.94)

      return {
        folder,
        files: subtreeFiles.slice(0, 8),
        totalVisualWeight,
        visibleFileCount,
        score,
      }
    })
    .filter((candidate) => candidate.visibleFileCount > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.visibleFileCount - left.visibleFileCount ||
        left.folder.path.localeCompare(right.folder.path),
    )

  const selected: FeaturedFolder[] = []

  for (const candidate of candidates) {
    if (
      selected.some(
        (entry) =>
          isAncestorPath(entry.folder.path, candidate.folder.path) ||
          isAncestorPath(candidate.folder.path, entry.folder.path),
      )
    ) {
      continue
    }

    selected.push({
      folder: candidate.folder,
      files: candidate.files,
      totalVisualWeight: candidate.totalVisualWeight,
      visibleFileCount: candidate.visibleFileCount,
    })

    if (selected.length === 4) {
      break
    }
  }

  if (selected.length < 4) {
    for (const candidate of candidates) {
      if (selected.some((entry) => entry.folder.path === candidate.folder.path)) {
        continue
      }

      selected.push({
        folder: candidate.folder,
        files: candidate.files,
        totalVisualWeight: candidate.totalVisualWeight,
        visibleFileCount: candidate.visibleFileCount,
      })

      if (selected.length === 4) {
        break
      }
    }
  }

  return selected
}

function buildSidebarNodes(
  folders: VisualFolder[],
  visibleFiles: VisibleRepoFile[],
): SidebarNode[] {
  const directChildren = new Map<string, VisualFolder[]>()

  for (const folder of folders) {
    if (!folder.parentPath) {
      continue
    }

    const siblings = directChildren.get(folder.parentPath) ?? []
    siblings.push(folder)
    directChildren.set(folder.parentPath, siblings)
  }

  return folders
    .filter((folder) => folder.depth === 1)
    .map((folder) => {
      const subtreeFiles = getVisibleFilesInSubtree(visibleFiles, folder.path)
      const visibleFileCount = subtreeFiles.length

      return {
        folder,
        children: (directChildren.get(folder.path) ?? [])
          .map((childFolder) => ({
            folder: childFolder,
            visibleFileCount: getVisibleFilesInSubtree(visibleFiles, childFolder.path).length,
          }))
          .filter((child) => child.visibleFileCount > 0)
          .sort(
            (left, right) =>
              right.visibleFileCount - left.visibleFileCount ||
              left.folder.path.localeCompare(right.folder.path),
          )
          .slice(0, 3),
        totalVisualWeight: subtreeFiles.reduce(
          (sum, entry) => sum + entry.currentVisualWeight,
          0,
        ),
        visibleFileCount,
      }
    })
    .filter((node) => node.visibleFileCount > 0)
    .sort(
      (left, right) =>
        right.totalVisualWeight - left.totalVisualWeight ||
        right.visibleFileCount - left.visibleFileCount ||
        left.folder.path.localeCompare(right.folder.path),
    )
}

function getVisibleFilesInSubtree(
  visibleFiles: VisibleRepoFile[],
  folderPath: string,
) {
  return visibleFiles.filter(
    (entry) =>
      entry.file.folderPath === folderPath ||
      entry.file.folderPath.startsWith(`${folderPath}/`),
  )
}

function formatPlaybackSpeed(speed: PlaybackSpeed) {
  return `${speed}x`
}

function isAncestorPath(leftPath: string, rightPath: string) {
  return rightPath.startsWith(`${leftPath}/`)
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}
