import { useState } from 'react'
import { timelineSteps } from '../data/docTimeline'

function clampStepIndex(index: number) {
  if (!Number.isFinite(index)) {
    return 0
  }

  const normalizedIndex = Math.trunc(index)

  return Math.min(Math.max(normalizedIndex, 0), timelineSteps.length - 1)
}

export function useDocTimeline() {
  const [currentStepIndex, setCurrentStepIndexState] = useState(0)

  function setStepIndex(index: number) {
    setCurrentStepIndexState(clampStepIndex(index))
  }

  function goPrevious() {
    setCurrentStepIndexState((index) => clampStepIndex(index - 1))
  }

  function goNext() {
    setCurrentStepIndexState((index) => clampStepIndex(index + 1))
  }

  function reset() {
    setCurrentStepIndexState(0)
  }

  return {
    currentStepIndex,
    currentStep: timelineSteps[currentStepIndex],
    stepCount: timelineSteps.length,
    canGoPrevious: currentStepIndex > 0,
    canGoNext: currentStepIndex < timelineSteps.length - 1,
    goPrevious,
    goNext,
    reset,
    setStepIndex,
  }
}
