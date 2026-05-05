import { motion, useReducedMotion } from 'motion/react'
import { getFadeSlideSide, springSoft } from '../../lib/motionPresets'

type CommentBubbleProps = {
  label: string
  body: string
  tone?: 'sky' | 'amber'
  active?: boolean
  delay?: number
}

const toneClasses: Record<NonNullable<CommentBubbleProps['tone']>, string> = {
  sky: 'border-sky-200/90 bg-sky-50/75 text-sky-900',
  amber: 'border-amber-200/90 bg-amber-50/78 text-amber-900',
}

const activeRingClasses: Record<NonNullable<CommentBubbleProps['tone']>, string> = {
  sky: 'shadow-[0_8px_18px_rgba(14,165,233,0.1)]',
  amber: 'shadow-[0_8px_18px_rgba(245,158,11,0.12)]',
}

export function CommentBubble({
  label,
  body,
  tone = 'sky',
  active = false,
  delay = 0,
}: CommentBubbleProps) {
  const shouldReduceMotion = useReducedMotion() ?? false
  const commentMotion = getFadeSlideSide(shouldReduceMotion, 14)

  return (
    <motion.aside
      layout
      initial={commentMotion.initial}
      animate={{
        ...commentMotion.animate,
        y: active && !shouldReduceMotion ? -1 : 0,
      }}
      exit={commentMotion.exit}
      transition={{
        ...springSoft,
        delay: shouldReduceMotion ? 0 : delay,
      }}
      className={[
        'border-l-2 border-r border-y px-2.5 py-2 shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition-[box-shadow,transform] duration-300',
        toneClasses[tone],
        active ? activeRingClasses[tone] : '',
      ].join(' ')}
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.22em]">
        {label}
      </p>
      <p className="mt-1.5 text-[10px] leading-[1.45] text-slate-600">{body}</p>
    </motion.aside>
  )
}
