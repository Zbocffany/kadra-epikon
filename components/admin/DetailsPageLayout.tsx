import Link from 'next/link'
import { ReactNode } from 'react'

type DetailsPageHeaderProps = {
  title: string
  backLabel: string
  backHref: string
  editHref: string
  deleteAction: (formData: FormData) => Promise<void>
  deleteId: string
}

type DetailsPageContentProps = {
  title: string
  breadcrumb: string
  saved?: string
  error?: string
  isEdit: boolean
  editContent: ReactNode
  viewContent: ReactNode
}

export function DetailsPageHeader({
  title,
  backLabel,
  backHref,
  editHref,
  deleteAction,
  deleteId,
}: DetailsPageHeaderProps) {
  return (
    <div className="mb-6 flex items-center justify-between gap-3">
      <Link
        href={backHref}
        className="text-sm text-neutral-400 underline decoration-neutral-700 underline-offset-4 hover:text-neutral-200"
      >
        {backLabel}
      </Link>

      <div className="flex items-center gap-2">
        <Link
          href={editHref}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
        >
          Edytuj
        </Link>
        <form action={deleteAction}>
          <input type="hidden" name="id" value={deleteId} />
          <button
            type="submit"
            className="rounded-md border border-red-800 bg-red-950/50 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-900/40"
          >
            Usun
          </button>
        </form>
      </div>
    </div>
  )
}

export function DetailsPageContent({
  title,
  breadcrumb,
  saved,
  error,
  isEdit,
  editContent,
  viewContent,
}: DetailsPageContentProps) {
  return (
    <>
      {saved && (
        <div className="mb-4 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-300">
          Zmiany zostaly zapisane.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          {breadcrumb}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>

        {isEdit ? editContent : viewContent}
      </div>
    </>
  )
}

export function DetailsPageContainer({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl">{children}</div>
    </main>
  )
}
