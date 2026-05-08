import { startTransition, useState } from 'react'
import { FakeGoogleDocScene } from '../scenes/FakeGoogleDocScene'
import { RepoExplorerScene } from '../scenes/RepoExplorerScene'
import { LIVE_REPO_DISPLAY_MODEL_URL } from '../hooks/useRepoDisplayModel'

type SceneId = 'document' | 'repository' | 'repository-v1'

const SCENE_OPTIONS = [
  { id: 'document', label: 'Document' },
  { id: 'repository', label: 'Repository' },
  { id: 'repository-v1', label: 'Repository V1' },
] as const

function App() {
  const [scene, setScene] = useState<SceneId>('repository')

  const sceneContent =
    scene === 'document' ? (
      <FakeGoogleDocScene />
    ) : scene === 'repository-v1' ? (
      <RepoExplorerScene
        key="repository-v1"
        modelUrl="/data/snapshots/repo-display-model-v1.json"
      />
    ) : (
      <RepoExplorerScene
        key="repository"
        modelUrl={LIVE_REPO_DISPLAY_MODEL_URL}
      />
    )

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-3">
        <div className="pointer-events-auto inline-flex rounded-full border border-white/10 bg-slate-950/75 px-1 py-0.5 shadow-[0_16px_60px_rgba(0,0,0,0.32)] backdrop-blur-md">
          {SCENE_OPTIONS.map((option) => {
            const isActive = scene === option.id

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  startTransition(() => {
                    setScene(option.id)
                  })
                }}
                className={`rounded-full px-4 py-1.5 text-sm transition ${
                  isActive
                    ? 'bg-white text-slate-950 shadow-[0_6px_18px_rgba(255,255,255,0.16)]'
                    : 'text-slate-300 hover:bg-white/8 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      {sceneContent}
    </div>
  )
}

export default App
