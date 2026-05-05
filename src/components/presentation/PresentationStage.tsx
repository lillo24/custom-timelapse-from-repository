import type { ReactNode } from 'react'

type PresentationStageProps = {
  children: ReactNode
}

export function PresentationStage({ children }: PresentationStageProps) {
  return (
    <div className="mx-auto flex h-full w-full items-center justify-center">
      <section className="relative aspect-video w-[min(100%,calc((100dvh-3rem)*16/9))] max-h-full max-w-[1280px] overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] shadow-[0_32px_120px_rgba(0,0,0,0.45)] backdrop-blur-sm">
        <div className="flex h-full flex-col">
          {children}
        </div>
      </section>
    </div>
  )
}
