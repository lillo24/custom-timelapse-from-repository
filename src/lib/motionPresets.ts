export const springSoft = {
  type: 'spring' as const,
  stiffness: 260,
  damping: 28,
  mass: 0.9,
}

export const springQuick = {
  type: 'spring' as const,
  stiffness: 320,
  damping: 26,
  mass: 0.78,
}

export function getFadeSlideUp(shouldReduceMotion: boolean, distance = 18) {
  if (shouldReduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    }
  }

  return {
    initial: { opacity: 0, y: distance, scale: 0.985 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -10, scale: 0.985 },
  }
}

export function getFadeSlideSide(shouldReduceMotion: boolean, distance = 16) {
  if (shouldReduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    }
  }

  return {
    initial: { opacity: 0, x: distance, scale: 0.985 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: Math.round(distance * 0.5), scale: 0.985 },
  }
}

export function getScaleFade(shouldReduceMotion: boolean) {
  if (shouldReduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    }
  }

  return {
    initial: { opacity: 0, scale: 0.96, y: 6 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.96, y: -6 },
  }
}

export function getHoverTapMotion(shouldReduceMotion: boolean) {
  if (shouldReduceMotion) {
    return {}
  }

  return {
    whileHover: { y: -1, scale: 1.02 },
    whileTap: { y: 0, scale: 0.985 },
  }
}

export function getStaggerDelay(index: number, step = 0.05) {
  return index * step
}
