import type { ReactNode } from 'react'

type RibbonButtonProps = {
  label: string
  compact?: boolean
  active?: boolean
  muted?: boolean
}

function RibbonButton({
  label,
  compact = false,
  active = false,
  muted = false,
}: RibbonButtonProps) {
  return (
    <span
      className={[
        'inline-flex cursor-default select-none items-center justify-center rounded-md border text-[11px] font-semibold text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]',
        compact ? 'min-w-7 px-2 py-1' : 'min-w-8 px-2.5 py-1.5',
        active
          ? 'border-sky-200 bg-sky-50 text-sky-700'
          : muted
            ? 'border-slate-200 bg-slate-50 text-slate-400'
            : 'border-slate-200 bg-white/95',
      ].join(' ')}
    >
      {label}
    </span>
  )
}

type PickerPillProps = {
  label: string
  widthClass?: string
}

function PickerPill({
  label,
  widthClass = 'min-w-[7.25rem]',
}: PickerPillProps) {
  return (
    <span
      className={[
        'inline-flex cursor-default select-none items-center justify-between gap-3 rounded-md border border-slate-200 bg-white/95 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]',
        widthClass,
      ].join(' ')}
    >
      <span className="truncate">{label}</span>
      <span className="text-[9px] text-slate-400">v</span>
    </span>
  )
}

type RibbonGroupProps = {
  label: string
  children: ReactNode
}

function RibbonGroup({ label, children }: RibbonGroupProps) {
  return (
    <div className="flex min-w-0 items-stretch gap-2 border-r border-slate-200/90 pr-3 last:border-r-0 last:pr-0">
      <div className="flex flex-col justify-between gap-2">
        <div className="flex items-center gap-1.5">{children}</div>
        <p className="text-center text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {label}
        </p>
      </div>
    </div>
  )
}

type WordLikeRibbonProps = {
  documentTitle: string
}

export function WordLikeRibbon({ documentTitle }: WordLikeRibbonProps) {
  return (
    <div className="shrink-0 border-b border-slate-200/90 bg-[linear-gradient(180deg,rgba(250,251,253,0.98),rgba(242,245,249,0.98))] px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:px-5">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200/70 pb-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#2563eb,#0ea5e9)] text-sm font-bold text-white shadow-[0_8px_20px_rgba(37,99,235,0.22)]">
              W
            </span>
            <div>
              <p className="text-[12px] font-semibold text-slate-800">
                {documentTitle}
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                Home
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-3 text-[11px] font-medium text-slate-500 md:flex">
            <span className="text-slate-900">Home</span>
            <span>Insert</span>
            <span>Layout</span>
            <span>Review</span>
            <span>View</span>
          </div>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <RibbonButton label="Comments" compact muted />
          <RibbonButton label="Share" compact />
        </div>
      </div>

      <div className="mt-2 flex items-start gap-3 overflow-hidden">
        <RibbonGroup label="Clipboard">
          <RibbonButton label="Paste" />
          <div className="flex items-center gap-1">
            <RibbonButton label="Cut" compact />
            <RibbonButton label="Copy" compact />
            <RibbonButton label="Fmt" compact muted />
          </div>
        </RibbonGroup>

        <RibbonGroup label="Font">
          <PickerPill label="Aptos (Body)" widthClass="min-w-[8.75rem]" />
          <PickerPill label="12" widthClass="min-w-[3.25rem]" />
          <div className="flex items-center gap-1">
            <RibbonButton label="B" compact />
            <RibbonButton label="I" compact />
            <RibbonButton label="U" compact />
            <RibbonButton label="ab" compact />
            <RibbonButton label="x2" compact />
            <RibbonButton label="A" compact active />
            <RibbonButton label="Clr" compact />
          </div>
        </RibbonGroup>

        <RibbonGroup label="Paragraph">
          <div className="flex items-center gap-1">
            <RibbonButton label="Bul" compact />
            <RibbonButton label="1." compact />
            <RibbonButton label="L" compact />
            <RibbonButton label="C" compact />
            <RibbonButton label="R" compact />
            <RibbonButton label="J" compact />
            <RibbonButton label="<" compact />
            <RibbonButton label=">" compact />
            <RibbonButton label="Marks" compact />
          </div>
        </RibbonGroup>
      </div>
    </div>
  )
}
