import { motion, useReducedMotion } from 'motion/react'
import { getFadeSlideSide, springSoft } from '../../lib/motionPresets'

type LegacyCommentBubbleProps = {
  label: string
  body: string
  tone?: 'sky' | 'amber'
  active?: boolean
  delay?: number
}

const toneClasses: Record<NonNullable<LegacyCommentBubbleProps['tone']>, string> = {
  sky: 'border-sky-200/90 bg-sky-50/90 text-sky-900',
  amber: 'border-amber-200/90 bg-amber-50/90 text-amber-900',
}

const activeRingClasses: Record<NonNullable<LegacyCommentBubbleProps['tone']>, string> = {
  sky: 'ring-1 ring-sky-200/70',
  amber: 'ring-1 ring-amber-200/70',
}

const pulseShadowColors: Record<NonNullable<LegacyCommentBubbleProps['tone']>, string> = {
  sky: 'rgba(14,165,233,0.14)',
  amber: 'rgba(245,158,11,0.16)',
}

export function LegacyCommentBubble({
  label,
  body,
  tone = 'sky',
  active = false,
  delay = 0,
}: LegacyCommentBubbleProps) {
  const shouldReduceMotion = useReducedMotion() ?? false
  const commentMotion = getFadeSlideSide(shouldReduceMotion, 14)

  return (
    <motion.aside
      layout
      initial={commentMotion.initial}
      animate={{
        ...commentMotion.animate,
        y: active && !shouldReduceMotion ? -2 : 0,
        scale: active && !shouldReduceMotion ? 1.01 : 1,
      }}
      exit={commentMotion.exit}
      transition={{
        ...springSoft,
        delay: shouldReduceMotion ? 0 : delay,
      }}
      className={[
        'rounded-2xl border px-3 py-3 shadow-[0_16px_34px_rgba(15,23,42,0.08)] backdrop-blur-sm transition-[box-shadow,transform] duration-300',
        toneClasses[tone],
        active ? activeRingClasses[tone] : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <motion.span
          className="h-2.5 w-2.5 rounded-full bg-current opacity-70"
          animate={
            active && !shouldReduceMotion
              ? {
                  opacity: [0.72, 1, 0.72],
                  scale: [1, 1.22, 1],
                  boxShadow: [
                    `0 0 0 0 ${pulseShadowColors[tone]}`,
                    `0 0 0 6px ${pulseShadowColors[tone]}`,
                    `0 0 0 0 ${pulseShadowColors[tone]}`,
                  ],
                }
              : {
                  opacity: 0.72,
                  scale: 1,
                  boxShadow: `0 0 0 0 ${pulseShadowColors[tone]}`,
                }
          }
          transition={
            active && !shouldReduceMotion
              ? {
                  duration: 2.2,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: 'easeInOut',
                }
              : {
                  duration: 0.2,
                }
          }
        />
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em]">
          {label}
        </p>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-slate-600">{body}</p>
    </motion.aside>
  )
}
