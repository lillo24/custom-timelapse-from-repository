import { useEffect, useState } from 'react'
import type { RepoVisualModel } from '../preprocessing/visualModelTypes'

const REPO_VISUAL_MODEL_URL = '/data/repo-visual-model.json'

type RepoVisualModelState = {
  model: RepoVisualModel | null
  error: string | null
  isLoading: boolean
}

export function useRepoVisualModel() {
  const [state, setState] = useState<RepoVisualModelState>({
    model: null,
    error: null,
    isLoading: true,
  })

  useEffect(() => {
    const abortController = new AbortController()

    async function loadModel() {
      try {
        const response = await fetch(REPO_VISUAL_MODEL_URL, {
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error(
            `Failed to load repository model (${response.status} ${response.statusText}).`,
          )
        }

        const parsed: unknown = await response.json()

        if (!isRepoVisualModel(parsed)) {
          throw new Error('Repository model JSON does not match the expected shape.')
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
          error: error instanceof Error ? error.message : 'Failed to load repository model.',
          isLoading: false,
        })
      }
    }

    void loadModel()

    return () => {
      abortController.abort()
    }
  }, [])

  return state
}

function isRepoVisualModel(value: unknown): value is RepoVisualModel {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<RepoVisualModel>

  return (
    Array.isArray(candidate.files) &&
    Array.isArray(candidate.folders) &&
    Array.isArray(candidate.timeline) &&
    Array.isArray(candidate.warnings) &&
    typeof candidate.generatedAt === 'string' &&
    typeof candidate.sourceDatasetPath === 'string' &&
    typeof candidate.summary === 'object' &&
    candidate.summary !== null
  )
}
