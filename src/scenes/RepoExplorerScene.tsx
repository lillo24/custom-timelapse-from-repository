import { motion, useReducedMotion } from 'motion/react'
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
} from '../preprocessing/visualModelTypes'

type FeaturedFolder = {
  folder: VisualFolder
  files: VisualFile[]
  totalVisualWeight: number
}

type SidebarNode = {
  folder: VisualFolder
  children: VisualFolder[]
  totalVisualWeight: number
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
                <RepoExplorerCanvas model={model} shouldReduceMotion={shouldReduceMotion} />
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
  const featuredFolders = selectFeaturedFolders(model)
  const sidebarNodes = buildSidebarNodes(model)
  const rootFiles = model.files
    .filter((file) => file.folderPath === '')
    .sort(
      (left, right) =>
        right.visualWeight - left.visualWeight || left.path.localeCompare(right.path),
    )
    .slice(0, 4)
  const largestFiles = [...model.files]
    .sort(
      (left, right) =>
        right.visualWeight - left.visualWeight ||
        right.maxLineCount - left.maxLineCount ||
        left.path.localeCompare(right.path),
    )
    .slice(0, 5)
  const visibleFileCount = featuredFolders.reduce(
    (sum, section) => sum + section.files.length,
    0,
  )
  const rootWeight = Math.max(
    model.files.reduce((sum, file) => sum + file.visualWeight, 0),
    1,
  )

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
              Static Repository View
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
              A static explorer surface built from the generated visual model.
              Folder groups expose the project shape, while file card size
              reflects durable code volume instead of transient edit churn.
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

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[248px_minmax(0,1fr)_272px]">
        <motion.aside
          initial={panelMotion.initial}
          animate={panelMotion.animate}
          transition={{ ...springSoft, delay: getStaggerDelay(1, 0.06) }}
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
              ) : null}
            </div>

            <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
              {sidebarNodes.map((node) => (
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
                      {formatNumber(node.folder.fileCount)}
                    </div>
                  </div>

                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800/90">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,rgba(45,212,191,0.9),rgba(56,189,248,0.75))]"
                      style={{
                        width: `${Math.max(16, Math.min(100, (node.totalVisualWeight / rootWeight) * 100))}%`,
                      }}
                    />
                  </div>

                  {node.children.length > 0 ? (
                    <div className="mt-3 space-y-2 border-l border-white/6 pl-3">
                      {node.children.map((child) => (
                        <div
                          key={child.id}
                          className="flex items-center justify-between gap-3 text-[12px] text-slate-300"
                        >
                          <span className="truncate">{child.name}</span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {formatNumber(child.fileCount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </motion.aside>

        <motion.section
          initial={panelMotion.initial}
          animate={panelMotion.animate}
          transition={{ ...springSoft, delay: getStaggerDelay(2, 0.06) }}
          className="min-h-0 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(7,12,24,0.92),rgba(4,8,18,0.94))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        >
          <div className="flex h-full flex-col gap-4">
            <PanelHeader
              title="Explorer clusters"
              subtitle="Folders grouped as repository neighborhoods"
            />

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto pr-1 2xl:grid-cols-2">
              {featuredFolders.map((section, index) => (
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
                          {formatNumber(section.folder.fileCount)} files
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
                      />
                    ))}
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.aside
          initial={panelMotion.initial}
          animate={panelMotion.animate}
          transition={{ ...springSoft, delay: getStaggerDelay(3, 0.06) }}
          className="min-h-0 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,28,0.94),rgba(4,8,18,0.94))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        >
          <div className="flex h-full flex-col gap-4">
            <PanelHeader
              title="Inspector"
              subtitle="Static cues for size, balance, and standout files"
            />

            <div className="rounded-[22px] border border-teal-400/15 bg-teal-400/[0.05] p-4">
              <div className="text-[11px] uppercase tracking-[0.26em] text-teal-100/80">
                Size basis
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                Card scale follows the visual model&apos;s persistent file-size
                metadata built from line counts. Timeline activity is kept
                separate so heavy churn does not permanently inflate file size.
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
                Largest visual files
              </div>
              <div className="mt-3 space-y-3">
                {largestFiles.map((file) => {
                  const categoryStyle = CATEGORY_STYLES[file.category] ?? CATEGORY_STYLES.unknown

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
                    </div>
                  )
                })}
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

function RepoFileCard({
  file,
  folderPath,
}: {
  file: VisualFile
  folderPath: string
}) {
  const layout = FILE_SIZE_LAYOUT[file.visualSize]
  const categoryStyle = CATEGORY_STYLES[file.category] ?? CATEGORY_STYLES.unknown
  const relativeFolder =
    folderPath === '' || file.folderPath === folderPath
      ? file.name
      : file.path.slice(folderPath.length + 1)

  return (
    <article
      className={`${layout.span} ${layout.minHeight} relative overflow-hidden rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${categoryStyle.glow}`}
      />

      <div className="flex h-full flex-col">
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

function RepoExplorerSkeleton() {
  return (
    <>
      <div className="space-y-4">
        <div className="h-7 w-56 rounded-full bg-white/8" />
        <div className="h-14 w-[28rem] max-w-full rounded-[24px] bg-white/6" />
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
          Re-run the preprocessing pipeline so
          {' '}
          <code className="rounded bg-black/20 px-1.5 py-0.5 text-[13px]">
            public/data/repo-visual-model.json
          </code>
          {' '}
          is refreshed for the app.
        </p>
      </div>
    </div>
  )
}

function selectFeaturedFolders(model: RepoVisualModel): FeaturedFolder[] {
  const candidates = model.folders
    .filter((folder) => folder.path !== '' && folder.fileCount > 0)
    .map((folder) => {
      const files = getFilesInSubtree(model.files, folder.path)
        .sort(
          (left, right) =>
            right.visualWeight - left.visualWeight ||
            right.maxLineCount - left.maxLineCount ||
            left.path.localeCompare(right.path),
        )
        .slice(0, 8)
      const totalVisualWeight = files.reduce(
        (sum, file) => sum + file.visualWeight,
        0,
      )
      const score =
        totalVisualWeight *
        (folder.depth === 2 ? 1.08 : folder.depth === 1 ? 1 : 0.94)

      return {
        folder,
        files,
        totalVisualWeight,
        score,
      }
    })
    .filter((candidate) => candidate.files.length > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.folder.fileCount - left.folder.fileCount ||
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
      })

      if (selected.length === 4) {
        break
      }
    }
  }

  return selected
}

function buildSidebarNodes(model: RepoVisualModel): SidebarNode[] {
  const directChildren = new Map<string, VisualFolder[]>()

  for (const folder of model.folders) {
    if (!folder.parentPath) {
      continue
    }

    const siblings = directChildren.get(folder.parentPath) ?? []
    siblings.push(folder)
    directChildren.set(folder.parentPath, siblings)
  }

  return model.folders
    .filter((folder) => folder.depth === 1)
    .map((folder) => ({
      folder,
      children: (directChildren.get(folder.path) ?? [])
        .sort(
          (left, right) =>
            right.fileCount - left.fileCount ||
            right.totalFinalLines - left.totalFinalLines ||
            left.path.localeCompare(right.path),
        )
        .slice(0, 3),
      totalVisualWeight: getFilesInSubtree(model.files, folder.path).reduce(
        (sum, file) => sum + file.visualWeight,
        0,
      ),
    }))
    .sort(
      (left, right) =>
        right.totalVisualWeight - left.totalVisualWeight ||
        right.folder.fileCount - left.folder.fileCount ||
        left.folder.path.localeCompare(right.folder.path),
    )
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

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}
