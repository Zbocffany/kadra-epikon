'use client'

type UnsavedChangesDialogProps = {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  title?: string
  message?: string
}

export default function UnsavedChangesDialog({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Niezapisane zmiany',
  message = 'Masz niezapisane zmiany. Czy na pewno chcesz opuścić tę stronę bez zapisania?',
}: UnsavedChangesDialogProps) {
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-lg border border-neutral-700 bg-neutral-900 shadow-xl">
          {/* Header */}
          <div className="border-b border-neutral-700 px-6 py-4">
            <h2 className="text-lg font-semibold text-neutral-100">{title}</h2>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            <p className="text-sm text-neutral-300">{message}</p>
          </div>

          {/* Footer */}
          <div className="border-t border-neutral-700 flex items-center justify-end gap-2 px-6 py-4">
            <button
              onClick={onCancel}
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
            >
              Nie, zostań
            </button>
            <button
              onClick={onConfirm}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Tak, opuść
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
