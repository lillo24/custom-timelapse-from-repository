import { motion, useReducedMotion } from 'motion/react'
import { getStaggerDelay } from '../../lib/motionPresets'

type FakeTextBlockProps = {
  lineWidths: number[]
}

function getStartingWidth(targetWidth: number) {
  return Math.max(28, Math.min(40, Math.round(targetWidth * 0.38)))
}

export function FakeTextBlock({ lineWidths }: FakeTextBlockProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <div className="space-y-2.5">
      {lineWidths.map((width, index) => {
        const startingWidth = getStartingWidth(width)

        return (
          <motion.div
            key={`${width}-${index}`}
            className="h-2.5 origin-left rounded-full bg-[linear-gradient(90deg,rgba(148,163,184,0.34),rgba(226,232,240,0.88))]"
            style={shouldReduceMotion ? { width: `${width}%` } : undefined}
            initial={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, width: `${startingWidth}%` }
            }
            animate={
              shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 1, width: `${width}%` }
            }
            transition={{
              duration: shouldReduceMotion ? 0.18 : 0.34,
              delay: shouldReduceMotion ? 0 : getStaggerDelay(index, 0.045),
              ease: [0.22, 1, 0.36, 1],
            }}
          />
        )
      })}
    </div>
  )
}
