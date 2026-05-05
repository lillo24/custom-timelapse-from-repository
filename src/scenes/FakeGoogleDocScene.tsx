import { PresentationStage } from '../components/presentation/PresentationStage'
import { DocShell } from '../components/google-doc/DocShell'
import {
  comments,
  documentTitle,
  docSections,
  versionEntries,
} from '../data/staticDocMock'

export function FakeGoogleDocScene() {
  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(191,219,254,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.12),transparent_28%),linear-gradient(180deg,#0f172a_0%,#020617_100%)] px-4 py-8 text-slate-50 sm:px-6 lg:px-10">
      <PresentationStage>
        <DocShell
          documentTitle={documentTitle}
          sections={docSections}
          comments={comments}
          versions={versionEntries}
        />
      </PresentationStage>
    </main>
  )
}
