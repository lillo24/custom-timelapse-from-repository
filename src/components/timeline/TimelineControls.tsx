import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { DocTimelineStep } from '../../data/docTimeline'
import {
  getFadeSlideUp,
  getHoverTapMotion,
  springQuick,
  springSoft,
} from '../../lib/motionPresets'

type TimelineControlsProps = {
  currentStep: DocTimelineStep
  currentStepIndex: number
  stepCount: number
  canGoPrevious: boolean
  canGoNext: boolean
  onPrevious: () => void
  onNext: () => void
  onReset: () => void
  onSelectStep: (index: number) => void
}

function getButtonClasses(disabled: boolean) {
  return [
    'rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-[background-color,border-color,color,transform] duration-200',
    disabled
      ? 'cursor-not-allowed border-white/10 bg-white/5 text-slate-500'
      : 'border-white/10 bg-white/10 text-slate-100 hover:border-white/20 hover:bg-white/20',
  ].join(' ')
}

export function TimelineControls({
  currentStep,
  currentStepIndex,
  stepCount,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
  onReset,
  onSelectStep,
}: TimelineControlsProps) {
  const shouldReduceMotion = useReducedMotion() ?? false
  const canReset = currentStepIndex > 0
  const stepMotion = getFadeSlideUp(shouldReduceMotion, 12)
  const buttonMotion = getHoverTapMotion(shouldReduceMotion)

  return (
    <div className="w-full px-3 py-2.5 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-400">
            Timeline
          </p>

          <div className="mt-1 min-h-[2rem]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep.id}
                initial={stepMotion.initial}
                animate={stepMotion.animate}
                exit={stepMotion.exit}
                transition={springSoft}
                className="flex flex-wrap items-center gap-x-2 gap-y-1"
              >
                <p className="font-display truncate text-base font-semibold tracking-[-0.04em] text-white sm:text-lg">
                  {currentStep.label} {'\u00B7'} {currentStep.subtitle}
                </p>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] text-slate-300">
                  {currentStepIndex + 1} / {stepCount}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: stepCount }, (_, index) => {
              const isActive = index === currentStepIndex

              return (
                <motion.button
                  key={index}
                  type="button"
                  aria-label={`Go to step ${index + 1}`}
                  aria-pressed={isActive}
                  onClick={() => onSelectStep(index)}
                  animate={
                    shouldReduceMotion
                      ? { opacity: isActive ? 1 : 0.75 }
                      : {
                          scale: isActive ? 1.08 : 1,
                          backgroundColor: isActive
                            ? '#38bdf8'
                            : 'rgba(100,116,139,0.8)',
                          boxShadow: isActive
                            ? '0 0 0 5px rgba(56,189,248,0.14)'
                            : '0 0 0 0 rgba(56,189,248,0)',
                        }
                  }
                  transition={springQuick}
                  className="h-2.5 w-2.5 rounded-full"
                  {...buttonMotion}
                />
              )
            })}
          </div>

          <div className="h-4 w-px bg-white/10" />

          <div className="flex items-center gap-1.5">
            <motion.button
              type="button"
              onClick={onPrevious}
              disabled={!canGoPrevious}
              className={getButtonClasses(!canGoPrevious)}
              transition={springQuick}
              {...(!canGoPrevious ? {} : buttonMotion)}
            >
              Previous
            </motion.button>
            <motion.button
              type="button"
              onClick={onNext}
              disabled={!canGoNext}
              className={getButtonClasses(!canGoNext)}
              transition={springQuick}
              {...(!canGoNext ? {} : buttonMotion)}
            >
              Next
            </motion.button>
            <motion.button
              type="button"
              onClick={onReset}
              disabled={!canReset}
              className={getButtonClasses(!canReset)}
              transition={springQuick}
              {...(!canReset ? {} : buttonMotion)}
            >
              Reset
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  )
}
