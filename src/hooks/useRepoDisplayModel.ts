import { useEffect, useState } from 'react'
import type { RepoDisplayModel } from '../preprocessing/displayModelTypes'

export const LIVE_REPO_DISPLAY_MODEL_URL = '/data/repo-display-model.json'

type RepoDisplayModelState = {
  model: RepoDisplayModel | null
  error: string | null
  isLoading: boolean
}

export function useRepoDisplayModel(
  modelUrl: string = LIVE_REPO_DISPLAY_MODEL_URL,
) {
  const [state, setState] = useState<RepoDisplayModelState>({
    model: null,
    error: null,
    isLoading: true,
  })

  useEffect(() => {
    const abortController = new AbortController()

    setState({
      model: null,
      error: null,
      isLoading: true,
    })

    async function loadModel() {
      try {
        const response = await fetch(modelUrl, {
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error(
            `Failed to load repository display model (${response.status} ${response.statusText}).`,
          )
        }

        const parsed: unknown = await response.json()

        if (!isRepoDisplayModel(parsed)) {
          throw new Error('Repository display model JSON does not match the expected shape.')
        }

        setState({
          model: parsed,
          error: null,
          isLoading: false,
        })
      } catch (error) {
        if (abortController.signal.aborted) {
          return
        }

        setState({
          model: null,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to load repository display model.',
          isLoading: false,
        })
      }
    }

    void loadModel()

    return () => {
      abortController.abort()
    }
  }, [modelUrl])

  return state
}

function isRepoDisplayModel(value: unknown): value is RepoDisplayModel {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<RepoDisplayModel>

  return (
    Array.isArray(candidate.nodes) &&
    Array.isArray(candidate.timeline) &&
    Array.isArray(candidate.visibilityFrames) &&
    Array.isArray(candidate.warnings) &&
    typeof candidate.generatedAt === 'string' &&
    typeof candidate.sourceVisualModelPath === 'string' &&
    typeof candidate.config === 'object' &&
    candidate.config !== null &&
    typeof candidate.summary === 'object' &&
    candidate.summary !== null
  )
}
