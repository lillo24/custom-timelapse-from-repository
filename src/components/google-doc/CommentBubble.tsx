type CommentBubbleProps = {
  label: string
  body: string
  tone?: 'sky' | 'amber'
}

const toneClasses: Record<NonNullable<CommentBubbleProps['tone']>, string> = {
  sky: 'border-sky-200/90 bg-sky-50/90 text-sky-900',
  amber: 'border-amber-200/90 bg-amber-50/90 text-amber-900',
}

export function CommentBubble({
  label,
  body,
  tone = 'sky',
}: CommentBubbleProps) {
  return (
    <aside
      className={[
        'rounded-2xl border px-3 py-3 shadow-[0_16px_34px_rgba(15,23,42,0.08)] backdrop-blur-sm',
        toneClasses[tone],
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-current opacity-70" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em]">
          {label}
        </p>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-slate-600">{body}</p>
    </aside>
  )
}
