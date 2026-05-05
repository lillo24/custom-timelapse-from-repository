import type { DocComment, DocSection, VersionEntry } from '../../data/staticDocMock'
import { DocumentPage } from './DocumentPage'
import { DocTopBar } from './DocTopBar'
import { VersionHistorySidebar } from './VersionHistorySidebar'

type DocShellProps = {
  documentTitle: string
  sections: DocSection[]
  comments: DocComment[]
  versions: VersionEntry[]
}

export function DocShell({
  documentTitle,
  sections,
  comments,
  versions,
}: DocShellProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[30px] border border-slate-200/80 bg-[#f3f6fb] text-slate-900 shadow-[0_26px_70px_rgba(15,23,42,0.16)]">
      <DocTopBar documentTitle={documentTitle} />

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_15rem] bg-[linear-gradient(180deg,rgba(241,245,249,0.94),rgba(226,232,240,0.84))] lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="relative min-w-0 overflow-hidden border-r border-slate-200/90">
          <div className="absolute -left-12 top-16 h-36 w-36 rounded-full bg-sky-200/35 blur-3xl" />
          <div className="absolute bottom-10 right-8 h-28 w-28 rounded-full bg-amber-100/60 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.45),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]" />

          <div className="relative flex h-full items-center justify-center px-4 py-5 sm:px-6 lg:px-8">
            <DocumentPage
              documentTitle={documentTitle}
              sections={sections}
              comments={comments}
            />
          </div>
        </div>

        <VersionHistorySidebar entries={versions} />
      </div>
    </div>
  )
}
