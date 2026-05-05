import type { VersionEntry } from '../../data/staticDocMock'
import { StatusPill } from './StatusPill'

type VersionHistorySidebarProps = {
  entries: VersionEntry[]
}

export function VersionHistorySidebar({
  entries,
}: VersionHistorySidebarProps) {
  return (
    <aside className="flex min-h-0 flex-col border-l border-slate-200/80 bg-[linear-gradient(180deg,rgba(246,248,252,0.98),rgba(237,242,247,0.98))] px-4 py-5 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
            Timeline rail
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.05em] text-slate-900">
            Version history
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            One checkpoint is highlighted now; the rest establish the thesis
            arc for later animation.
          </p>
        </div>

        <StatusPill tone="emerald">7 entries</StatusPill>
      </div>

      <div className="mt-5 min-h-0 flex-1 space-y-3 overflow-hidden">
        {entries.map((entry) => {
          const active = entry.active === true

          return (
            <article
              key={entry.id}
              className={[
                'rounded-[22px] border px-4 py-3.5 transition-colors',
                active
                  ? 'border-sky-200 bg-white shadow-[0_22px_44px_rgba(14,116,144,0.12)]'
                  : 'border-slate-200/80 bg-white/72',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={[
                        'h-2.5 w-2.5 rounded-full',
                        active ? 'bg-sky-500' : 'bg-slate-300',
                      ].join(' ')}
                    />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                      {entry.milestone}
                    </p>
                  </div>
                  <h3 className="mt-2 font-display text-lg font-semibold tracking-[-0.03em] text-slate-900">
                    {entry.label}
                  </h3>
                </div>

                {active ? (
                  <StatusPill tone="blue" className="shrink-0">
                    Active
                  </StatusPill>
                ) : null}
              </div>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                {entry.description}
              </p>
            </article>
          )
        })}
      </div>
    </aside>
  )
}
