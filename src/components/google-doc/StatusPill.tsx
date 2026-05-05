import type { ReactNode } from 'react'

type StatusPillProps = {
  children: ReactNode
  tone?: 'slate' | 'blue' | 'amber' | 'emerald'
  className?: string
}

const toneClasses: Record<NonNullable<StatusPillProps['tone']>, string> = {
  slate:
    'border-slate-200/80 bg-white/80 text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]',
  blue: 'border-sky-200/90 bg-sky-50 text-sky-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]',
  amber:
    'border-amber-200/90 bg-amber-50 text-amber-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]',
  emerald:
    'border-emerald-200/90 bg-emerald-50 text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]',
}

export function StatusPill({
  children,
  tone = 'slate',
  className = '',
}: StatusPillProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium tracking-[0.02em]',
        toneClasses[tone],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  )
}
