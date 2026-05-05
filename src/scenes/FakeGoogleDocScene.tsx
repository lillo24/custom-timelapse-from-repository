import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useEffectEvent, useState } from 'react'
import {
  DocShell,
  type DocumentVariant,
} from '../components/google-doc/DocShell'
import { TimelineControls } from '../components/timeline/TimelineControls'
import { PresentationStage } from '../components/presentation/PresentationStage'
import { documentTitle, getTimelineFrame } from '../data/docTimeline'
import {
  getLegacyTimelineFrame,
  legacyDocumentTitle,
} from '../data/legacyDocTimeline'
import { useDocTimeline } from '../hooks/useDocTimeline'
import { getFadeSlideUp, springSoft } from '../lib/motionPresets'

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  )
}

export function FakeGoogleDocScene() {
  const shouldReduceMotion = useReducedMotion() ?? false
  const [documentVariant, setDocumentVariant] =
    useState<DocumentVariant>('current')
  const {
    currentStepIndex,
    currentStep,
    stepCount,
    canGoPrevious,
    canGoNext,
    goPrevious,
    goNext,
    reset,
    setStepIndex,
  } = useDocTimeline()
  const frame = getTimelineFrame(currentStep)
  const legacyFrame = getLegacyTimelineFrame(currentStepIndex)
  const overlayMotion = getFadeSlideUp(shouldReduceMotion, 10)

  const handleKeyboardShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      isEditableTarget(event.target)
    ) {
      return
    }

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        goNext()
        break
      case 'ArrowLeft':
        event.preventDefault()
        goPrevious()
        break
      case 'Home':
        event.preventDefault()
        setStepIndex(0)
        break
      case 'End':
        event.preventDefault()
        setStepIndex(stepCount - 1)
        break
      default:
        break
    }
  })

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      handleKeyboardShortcut(event)
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return (
    <main className="flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(191,219,254,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.12),transparent_28%),linear-gradient(180deg,#0f172a_0%,#020617_100%)] p-4 text-slate-50 sm:p-5 lg:p-6">
      <div className="flex h-full w-full items-center justify-center">
        <PresentationStage>
          <div className="relative h-full">
            <div className="h-full pb-[82px]">
              <DocShell
                documentTitle={documentTitle}
                legacyDocumentTitle={legacyDocumentTitle}
                blocks={frame.blocks}
                notes={frame.notes}
                legacySections={legacyFrame.sections}
                legacyComments={legacyFrame.comments}
                documentVariant={documentVariant}
                onDocumentVariantChange={setDocumentVariant}
              />
            </div>

            <motion.div
              initial={overlayMotion.initial}
              animate={overlayMotion.animate}
              transition={springSoft}
              className="absolute inset-x-0 bottom-0 z-20 flex justify-center"
            >
              <div className="w-full max-w-[1080px] px-1">
                <TimelineControls
                  currentStep={currentStep}
                  currentStepIndex={currentStepIndex}
                  stepCount={stepCount}
                  canGoPrevious={canGoPrevious}
                  canGoNext={canGoNext}
                  onPrevious={goPrevious}
                  onNext={goNext}
                  onReset={reset}
                  onSelectStep={setStepIndex}
                />
              </div>
            </motion.div>
          </div>
        </PresentationStage>
      </div>
    </main>
  )
}
