import type { ReactNode } from 'react'

type PresentationStageProps = {
  children: ReactNode
}

export function PresentationStage({ children }: PresentationStageProps) {
  return (
    <div className="mx-auto flex w-full max-w-[min(92vw,1280px)] items-center justify-center">
      <section className="aspect-video w-full overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] shadow-[0_32px_120px_rgba(0,0,0,0.45)] backdrop-blur-sm">
        <div className="flex h-full flex-col bg-[linear-gradient(180deg,rgba(15,23,42,0.22),rgba(15,23,42,0.08))] p-5 sm:p-8 lg:p-10">
          {children}
        </div>
      </section>
    </div>
  )
}
