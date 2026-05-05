import { StatusPill } from './StatusPill'

type DocTopBarProps = {
  documentTitle: string
}

const toolbarItems = ['Outline', 'Sources', 'Citations']

export function DocTopBar({ documentTitle }: DocTopBarProps) {
  return (
    <header className="border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.92))] px-5 py-4 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#cbd5e1,#f8fafc)] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
            <div className="h-5 w-4 rounded-[6px] border border-white/90 bg-white shadow-[inset_0_-3px_0_rgba(148,163,184,0.16)]" />
          </div>

          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold tracking-[-0.04em] text-slate-900 sm:text-xl">
              {documentTitle}
            </p>
            <p className="truncate text-sm text-slate-500">
              Saved {'\u00B7'} Presentation mock
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {toolbarItems.map((item) => (
            <StatusPill key={item}>{item}</StatusPill>
          ))}
          <StatusPill tone="blue" className="ml-2">
            Version history
          </StatusPill>
        </div>
      </div>
    </header>
  )
}
