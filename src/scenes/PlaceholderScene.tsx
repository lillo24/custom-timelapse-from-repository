import { PresentationStage } from '../components/presentation/PresentationStage'

export function PlaceholderScene() {
  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.14),transparent_34%),linear-gradient(180deg,#0f172a_0%,#020617_100%)] px-4 py-8 text-slate-50 sm:px-6 lg:px-10">
      <PresentationStage>
        <div className="flex h-full flex-col gap-6">
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-4">
              <span className="font-mono inline-flex w-fit rounded-full border border-slate-700/70 bg-slate-900/65 px-4 py-2 text-[11px] uppercase tracking-[0.32em] text-slate-300">
                Step 01 {'\u00B7'} Project scaffold
              </span>

              <div className="space-y-3">
                <h1 className="font-display text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl lg:text-[3.25rem]">
                  Presentation Timelapse Lab
                </h1>
                <p className="max-w-2xl text-sm text-slate-300 sm:text-base">
                  Fake Google Docs scene scaffold
                </p>
              </div>
            </div>

            <div className="hidden rounded-full border border-white/12 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.26em] text-slate-400 sm:block">
              16:9 stage
            </div>
          </div>

          <div className="flex-1 rounded-[28px] border border-slate-300/70 bg-white/88 p-4 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] sm:p-6 lg:p-8">
            <div className="flex h-full flex-col gap-4 rounded-[22px] border border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.96))] p-4 sm:p-6">
              <div className="flex items-center justify-between gap-4 text-[11px] uppercase tracking-[0.24em] text-slate-500">
                <span>Scene canvas</span>
                <span>Reserved for later implementation</span>
              </div>

              <div className="grid flex-1 place-items-center rounded-[18px] border border-slate-300/80 bg-[linear-gradient(135deg,rgba(226,232,240,0.55),rgba(255,255,255,0.92))] px-6 py-8">
                <div className="max-w-md text-center">
                  <p className="font-display text-lg font-semibold tracking-[-0.03em] text-slate-900 sm:text-xl">
                    Future scene area
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
                    This space is intentionally held for the later Google Docs
                    timelapse composition, version history UI, and animation
                    pass.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PresentationStage>
    </main>
  )
}
