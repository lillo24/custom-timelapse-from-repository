import { motion, useReducedMotion } from 'motion/react'
import { startTransition, useState } from 'react'
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

type FeaturedFolder = {
  folder: VisualFolder
  files: VisualFile[]
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
  visibleFiles: VisualFile[]
  recentActivityByFileId: Map<string, number>
  recentTouchedCount: number
}

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
    minHeight: string
  }
> = {
  xs: {
    span: 'col-span-2 lg:col-span-1',
    minHeight: 'min-h-[76px]',
  },
  sm: {
    span: 'col-span-2',
    minHeight: 'min-h-[90px]',
  },
  md: {
    span: 'col-span-3',
    minHeight: 'min-h-[112px]',
  },
  lg: {
    span: 'col-span-3 xl:col-span-4',
    minHeight: 'min-h-[134px]',
  },
  xl: {
    span: 'col-span-4',
    minHeight: 'min-h-[156px]',
  },
}

const SIZE_LABELS: Record<VisualFileSize, string> = {
  xs: 'Pocket',
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
  xl: 'Anchor',
}

const RECENT_UNIT_WINDOW = 20

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
  const cardMotion = getScaleFade(shouldReduceMotion)
  const maxUnitIndex = Math.max(model.timeline.length - 1, 0)
  const [activeUnitIndex, setActiveUnitIndex] = useState(maxUnitIndex)
  const clampedActiveUnitIndex = clampNumber(activeUnitIndex, 0, maxUnitIndex)
  const progressState = buildRepoProgressState(model, clampedActiveUnitIndex)
  const activeUnit = progressState.activeUnit
  const visibleFiles = progressState.visibleFiles
  const visibleFileCount = visibleFiles.length
  const visibleFolderCount = countVisibleFolders(model.folders, visibleFiles)
  const featuredFolders = selectFeaturedFolders(model.folders, visibleFiles)
  const sidebarNodes = buildSidebarNodes(model.folders, visibleFiles)
  const rootFiles = visibleFiles
    .filter((file) => file.folderPath === '')
    .sort(
      (left, right) =>
        right.visualWeight - left.visualWeight || left.path.localeCompare(right.path),
    )
    .slice(0, 4)
  const largestFiles = [...visibleFiles]
    .sort(
      (left, right) =>
        right.visualWeight - left.visualWeight ||
        right.maxLineCount - left.maxLineCount ||
        left.path.localeCompare(right.path),
    )
    .slice(0, 5)
  const visibleWeightTotal = Math.max(
    visibleFiles.reduce((sum, file) => sum + file.visualWeight, 0),
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

  function updateActiveUnitIndex(nextIndex: number) {
    startTransition(() => {
      setActiveUnitIndex(clampNumber(nextIndex, 0, maxUnitIndex))
    })
  }

  return (
    <>
      <motion.header
        initial={headerMotion.initial}
        animate={headerMotion.animate}
        transition={springSoft}
        className="flex items-start justify-between gap-6"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.34em] text-slate-300">
              <span className="h-2 w-2 rounded-full bg-teal-300 shadow-[0_0_0_4px_rgba(45,212,191,0.12)]" />
              Repository Progression
            </div>
            <div className="rounded-full border border-slate-700/80 bg-slate-950/55 px-3 py-1.5 text-[10px] uppercase tracking-[0.3em] text-slate-400">
              Size follows file state, not activity
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="font-display text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl lg:text-[3.15rem]">
              Repository evolution
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-300 sm:text-[15px]">
              Progress through the generated timeline and reveal the repository
              as files appear. Recent edit energy only adds a temporary glow;
              card size stays tied to durable file-size metadata.
            </p>
          </div>
        </div>

        <div className="hidden min-w-[248px] rounded-[26px] border border-white/10 bg-slate-950/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] lg:block">
          <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
            Model snapshot
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatPill label="Files" value={formatNumber(model.summary.fileCount)} />
            <StatPill label="Folders" value={formatNumber(model.summary.folderCount)} />
            <StatPill label="Units" value={formatNumber(model.summary.unitCount)} />
            <StatPill label="Visible" value={formatNumber(visibleFileCount)} />
          </div>
        </div>
      </motion.header>

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
            </div>
            <div className="mt-2 text-sm text-slate-400">
              {formatNumber(visibleFileCount)} visible files /{' '}
              {formatNumber(visibleFolderCount)} visible folders /{' '}
              {formatNumber(progressState.recentTouchedCount)} recently touched
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
              <span>Recent glow window: {RECENT_UNIT_WINDOW} units</span>
              <span>Current</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
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
              isPrimary
            />
          </div>
        </div>
      </motion.section>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[248px_minmax(0,1fr)_272px]">
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
                  {rootFiles.map((file) => (
                    <span
                      key={file.id}
                      className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300"
                    >
                      {file.name}
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
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,rgba(45,212,191,0.9),rgba(56,189,248,0.75))]"
                        style={{
                          width: `${Math.max(16, Math.min(100, (node.totalVisualWeight / visibleWeightTotal) * 100))}%`,
                        }}
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
              {featuredFolders.length > 0 ? (
                featuredFolders.map((section, index) => (
                  <motion.article
                    key={section.folder.id}
                    initial={cardMotion.initial}
                    animate={cardMotion.animate}
                    transition={{ ...springSoft, delay: getStaggerDelay(index, 0.04) }}
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
                          {section.files[0] ? section.files[0].category : 'files'}-heavy
                          subtree
                        </p>
                      </div>

                      <span className="rounded-full border border-teal-400/20 bg-teal-400/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-teal-100">
                        {section.totalVisualWeight.toFixed(1)} weight
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-4 gap-3 xl:grid-cols-5">
                      {section.files.map((file) => (
                        <RepoFileCard
                          key={file.id}
                          file={file}
                          folderPath={section.folder.path}
                          highlightStrength={
                            progressState.recentActivityByFileId.get(file.id) ?? 0
                          }
                          shouldReduceMotion={shouldReduceMotion}
                        />
                      ))}
                    </div>
                  </motion.article>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm leading-6 text-slate-400">
                  No repository files are visible at the selected position yet.
                </div>
              )}
            </div>
          </div>
        </motion.section>

        <motion.aside
          initial={panelMotion.initial}
          animate={panelMotion.animate}
          transition={{ ...springSoft, delay: getStaggerDelay(4, 0.06) }}
          className="min-h-0 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,28,0.94),rgba(4,8,18,0.94))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        >
          <div className="flex h-full flex-col gap-4">
            <PanelHeader
              title="Inspector"
              subtitle="Static size cues plus local activity highlights"
            />

            <div className="rounded-[22px] border border-teal-400/15 bg-teal-400/[0.05] p-4">
              <div className="text-[11px] uppercase tracking-[0.26em] text-teal-100/80">
                Size basis
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                Permanent card geometry stays tied to the visual model&apos;s
                file-size metadata. The last {RECENT_UNIT_WINDOW} timeline units
                only add temporary glow cues.
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
                Largest visible files
              </div>
              <div className="mt-3 space-y-3">
                {largestFiles.length > 0 ? (
                  largestFiles.map((file) => {
                    const categoryStyle =
                      CATEGORY_STYLES[file.category] ?? CATEGORY_STYLES.unknown
                    const recentActivity =
                      progressState.recentActivityByFileId.get(file.id) ?? 0

                    return (
                      <div
                        key={file.id}
                        className="rounded-[18px] border border-white/6 bg-slate-950/50 px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] ${categoryStyle.badge}`}
                          >
                            {categoryStyle.label}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500">
                            {formatNumber(file.maxLineCount)} lines
                          </span>
                        </div>
                        <div className="mt-2 text-sm font-medium text-slate-100">
                          {file.name}
                        </div>
                        <div className="mt-1 truncate font-mono text-[11px] text-slate-500">
                          {file.path}
                        </div>
                        {recentActivity > 0 ? (
                          <div className="mt-2 text-[11px] uppercase tracking-[0.22em] text-teal-200/80">
                            Recently touched
                          </div>
                        ) : null}
                      </div>
                    )
                  })
                ) : (
                  <EmptyPanelState message="Visible file details will appear as the timeline advances." />
                )}
              </div>
            </div>

            <div className="min-h-0 rounded-[22px] border border-white/8 bg-white/[0.02] p-4">
              <div className="text-[11px] uppercase tracking-[0.26em] text-slate-500">
                Model warnings
              </div>
              <div className="mt-3 space-y-2 overflow-y-auto pr-1 text-[13px] leading-5 text-slate-300">
                {model.warnings.length > 0 ? (
                  model.warnings.slice(0, 4).map((warning) => (
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

function RepoFileCard({
  file,
  folderPath,
  highlightStrength,
  shouldReduceMotion,
}: {
  file: VisualFile
  folderPath: string
  highlightStrength: number
  shouldReduceMotion: boolean
}) {
  const layout = FILE_SIZE_LAYOUT[file.visualSize]
  const categoryStyle = CATEGORY_STYLES[file.category] ?? CATEGORY_STYLES.unknown
  const relativeFolder =
    folderPath === '' || file.folderPath === folderPath
      ? file.name
      : file.path.slice(folderPath.length + 1)
  const glowOpacity =
    highlightStrength > 0
      ? clampNumber(0.16 + highlightStrength * 0.32, 0.16, 0.48)
      : 0
  const borderColor =
    highlightStrength > 0 ? 'rgba(45,212,191,0.28)' : 'rgba(255,255,255,0.08)'

  // Keep geometry tied to persistent file-size metadata; timeline activity only
  // affects temporary emphasis such as glow and contrast.
  return (
    <article
      style={{
        borderColor,
        boxShadow:
          highlightStrength > 0
            ? `0 18px 42px rgba(5,10,20,0.34), 0 0 ${14 + highlightStrength * 20}px rgba(45,212,191,${0.08 + highlightStrength * 0.14}), inset 0 1px 0 rgba(255,255,255,0.04)`
            : 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
      className={`${layout.span} ${layout.minHeight} relative overflow-hidden rounded-[20px] border bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-3`}
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
            <div className="truncate font-display text-[15px] font-medium tracking-[-0.03em] text-white">
              {file.name}
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
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,rgba(56,189,248,0.75),rgba(45,212,191,0.9))]"
                style={{
                  width: `${Math.max(20, Math.min(100, file.visualWeight * 100))}%`,
                }}
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
              {SIZE_LABELS[file.visualSize]}
            </div>
            <div className="mt-1 text-slate-200">
              {formatNumber(file.maxLineCount)} max lines
            </div>
          </div>

          <div className="text-right">
            <div className="font-mono uppercase tracking-[0.2em] text-slate-500">
              Final
            </div>
            <div className="mt-1 text-slate-200">
              {formatNumber(file.finalLineCount)}
            </div>
          </div>
        </div>
      </div>
    </article>
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

function StatPill({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-2.5">
      <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">
        {value}
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
  if (model.timeline.length === 0) {
    return {
      activeUnit: null,
      visibleFiles: model.files,
      recentActivityByFileId: new Map<string, number>(),
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
      recentActivityByFileId: new Map<string, number>(),
      recentTouchedCount: 0,
    }
  }

  const visibilityByFileId = new Map<string, boolean>()

  for (const file of model.files) {
    visibilityByFileId.set(
      file.id,
      file.firstUnitOrder !== null && file.firstUnitOrder <= activeUnit.unitOrder,
    )
  }

  for (let index = 0; index <= clampedActiveUnitIndex; index += 1) {
    const unit = model.timeline[index]

    if (!unit) {
      continue
    }

    if (unit.type === 'delete') {
      visibilityByFileId.set(unit.fileId, false)
      continue
    }

    if (unit.type === 'create' || unit.type === 'copy') {
      visibilityByFileId.set(unit.fileId, true)
    }
  }

  const recentActivityByFileId = new Map<string, number>()
  const recentUnitStartIndex = Math.max(0, clampedActiveUnitIndex - (RECENT_UNIT_WINDOW - 1))

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

  return {
    activeUnit,
    visibleFiles: model.files.filter((file) => visibilityByFileId.get(file.id) === true),
    recentActivityByFileId,
    recentTouchedCount: recentActivityByFileId.size,
  }
}

function selectFeaturedFolders(
  folders: VisualFolder[],
  visibleFiles: VisualFile[],
): FeaturedFolder[] {
  const candidates = folders
    .filter((folder) => folder.path !== '')
    .map((folder) => {
      const subtreeFiles = getFilesInSubtree(visibleFiles, folder.path)
        .sort(
          (left, right) =>
            right.visualWeight - left.visualWeight ||
            right.maxLineCount - left.maxLineCount ||
            left.path.localeCompare(right.path),
        )

      const totalVisualWeight = subtreeFiles.reduce(
        (sum, file) => sum + file.visualWeight,
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
  visibleFiles: VisualFile[],
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
      const subtreeFiles = getFilesInSubtree(visibleFiles, folder.path)
      const visibleFileCount = subtreeFiles.length

      return {
        folder,
        children: (directChildren.get(folder.path) ?? [])
          .map((childFolder) => ({
            folder: childFolder,
            visibleFileCount: getFilesInSubtree(visibleFiles, childFolder.path).length,
          }))
          .filter((child) => child.visibleFileCount > 0)
          .sort(
            (left, right) =>
              right.visibleFileCount - left.visibleFileCount ||
              left.folder.path.localeCompare(right.folder.path),
          )
          .slice(0, 3),
        totalVisualWeight: subtreeFiles.reduce(
          (sum, file) => sum + file.visualWeight,
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

function countVisibleFolders(
  folders: VisualFolder[],
  visibleFiles: VisualFile[],
): number {
  let count = 0

  for (const folder of folders) {
    if (folder.path === '') {
      count += 1
      continue
    }

    if (getFilesInSubtree(visibleFiles, folder.path).length > 0) {
      count += 1
    }
  }

  return count
}

function getFilesInSubtree(files: VisualFile[], folderPath: string) {
  return files.filter(
    (file) =>
      file.folderPath === folderPath ||
      file.folderPath.startsWith(`${folderPath}/`),
  )
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
