import { startTransition, useState } from 'react'
import { FakeGoogleDocScene } from '../scenes/FakeGoogleDocScene'
import { RepoExplorerScene } from '../scenes/RepoExplorerScene'

type SceneId = 'document' | 'repository'

function App() {
  const [scene, setScene] = useState<SceneId>('repository')

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-3">
        <div className="pointer-events-auto inline-flex rounded-full border border-white/10 bg-slate-950/75 px-1 py-0.5 shadow-[0_16px_60px_rgba(0,0,0,0.32)] backdrop-blur-md">
          {(
            [
              { id: 'document', label: 'Document' },
              { id: 'repository', label: 'Repository' },
            ] as const
          ).map((option) => {
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

      {scene === 'repository' ? <RepoExplorerScene /> : <FakeGoogleDocScene />}
    </div>
  )
}

export default App
