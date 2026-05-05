import { motion, useReducedMotion } from 'motion/react'
import { getScaleFade, springQuick } from '../../lib/motionPresets'

type EditMarkerProps = {
  label?: string
}

export function EditMarker({ label = 'Live revision' }: EditMarkerProps) {
  const shouldReduceMotion = useReducedMotion() ?? false
  const markerMotion = getScaleFade(shouldReduceMotion)

  return (
    <motion.div
      initial={markerMotion.initial}
      animate={markerMotion.animate}
      exit={markerMotion.exit}
      transition={springQuick}
      className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-white/92 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-700 shadow-[0_12px_28px_rgba(14,165,233,0.12)]"
    >
      <motion.span
        className="h-3 w-1 rounded-full bg-sky-500"
        animate={
          shouldReduceMotion
            ? { opacity: 1 }
            : {
                opacity: [0.75, 1, 0.75],
                scaleY: [1, 1.18, 1],
              }
        }
        transition={
          shouldReduceMotion
            ? { duration: 0.2 }
            : {
                duration: 1.8,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'easeInOut',
              }
        }
      />
      <span>{label}</span>
    </motion.div>
  )
}
