import Link from 'next/link'
import { ReactNode } from 'react'
import ConfirmSubmitButton from '@/components/admin/ConfirmSubmitButton'

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
  const deleteTargetLabel = title.trim() && title !== '—' ? `"${title}"` : 'ten element'

  return (
    <div className="mb-6 flex items-center justify-between gap-3">
      <Link
        href={backHref}
        className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
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
          <ConfirmSubmitButton
            type="submit"
            confirmMessage={`Czy na pewno chcesz usunąć ${deleteTargetLabel}?`}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
          >
            Usuń
          </ConfirmSubmitButton>
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
  void saved
  void error

  return (
    <>
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

export function DetailsPageContainer({
  children,
  maxWidthClass = 'max-w-3xl',
}: {
  children: ReactNode
  maxWidthClass?: string
}) {
  return (
    <main className="min-h-screen px-4 py-10 sm:px-8">
      <div className={`mx-auto ${maxWidthClass}`}>{children}</div>
    </main>
  )
}

