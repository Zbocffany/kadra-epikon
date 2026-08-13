'use client'

import { startTransition, useActionState, useRef, useState, type ReactNode } from 'react'
import { saveMatchFullWithState, type SaveMatchFullState } from '../actions'
import ValidationIssuesModal from './ValidationIssuesModal'

type Props = {
  matchId: string
  initialErrors: string[]
  initialPlainError: string | null
  children: ReactNode
}

// Wraps the match-edit <form> so that validation/constraint errors no longer
// blow away the in-memory form state (added players, events, etc.). When the
// underlying server action returns an error, this component just displays the
// modal/banner — the rest of the form stays mounted with all unsaved changes.
//
// IMPORTANT: We do NOT use <form action={formAction}> here. React 19 auto-resets
// the form right after a server action completes, which wipes controlled native
// <select> values (e.g. the squad's "Pozycja" column) until React's next sync.
// To prevent that reset we handle submit manually via onSubmit + startTransition.
export default function MatchEditFormShell({ matchId, initialErrors, initialPlainError, children }: Props) {
  const initial: SaveMatchFullState = (initialErrors.length > 0 || initialPlainError)
    ? { errors: initialErrors, plainError: initialPlainError }
    : null
  const [state, dispatch, isPending] = useActionState<SaveMatchFullState, FormData>(saveMatchFullWithState, initial)
  const [dismissedErrorsFor, setDismissedErrorsFor] = useState<SaveMatchFullState>(null)
  const [dismissedPlainFor, setDismissedPlainFor] = useState<SaveMatchFullState>(null)
  const [dismissedConfirmationFor, setDismissedConfirmationFor] = useState<SaveMatchFullState>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const pendingConfirmationData = useRef<FormData | null>(null)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    // If the submitter has its own formAction (e.g. the Delete button), let
    // React/browser handle that server action natively — don't intercept.
    if (submitter && submitter.getAttribute('formaction')) return
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    if (submitter?.name) formData.append(submitter.name, submitter.value ?? '')
    pendingConfirmationData.current = formData
    startTransition(() => dispatch(formData))
  }

  function confirmSubstitutionWithoutReplacement() {
    const formData = pendingConfirmationData.current
    if (!formData) return
    formData.set('confirm_substitution_without_replacement', '1')
    startTransition(() => dispatch(formData))
  }

  const errors = state?.errors ?? []
  const plainError = state?.plainError ?? null
  const confirmationWarnings = state?.confirmationWarnings ?? []
  const showModal = errors.length > 0 && dismissedErrorsFor !== state
  const showConfirmation = confirmationWarnings.length > 0 && dismissedConfirmationFor !== state

  return (
    <>
      <form ref={formRef} onSubmit={handleSubmit} aria-busy={isPending}>
        {plainError && dismissedPlainFor !== state && (
          <div className="mb-6 flex items-start justify-between gap-3 rounded-lg border border-red-800 bg-red-950/50 px-5 py-4 text-sm text-red-300">
            <span>{plainError}</span>
            <button
              type="button"
              onClick={() => setDismissedPlainFor(state)}
              aria-label="Zamknij komunikat"
              className="rounded-md border border-red-800 bg-red-950/70 px-2 py-0.5 text-xs font-semibold text-red-200 hover:bg-red-900"
            >
              ×
            </button>
          </div>
        )}
        {children}
      </form>
      {showModal && (
        <ValidationIssuesModal
          errors={errors}
          exitHref={`/admin/matches/${matchId}`}
          onAcknowledge={() => setDismissedErrorsFor(state)}
        />
      )}
      {showConfirmation && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="substitution-warning-title">
            <div className="w-full max-w-md rounded-lg border border-amber-700 bg-neutral-900 shadow-xl">
              <div className="border-b border-neutral-700 px-6 py-4">
                <h2 id="substitution-warning-title" className="text-lg font-semibold text-neutral-100">Zejście bez zmiennika</h2>
              </div>
              <div className="space-y-3 px-6 py-4 text-sm text-neutral-300">
                <p>
                  W {confirmationWarnings.length === 1 ? `wierszu ${confirmationWarnings[0]}` : `wierszach ${confirmationWarnings.join(', ')}`} nie wskazano zawodnika wchodzącego.
                </p>
                <p>Czy na pewno było to zejście z boiska bez zmiennika?</p>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-neutral-700 px-6 py-4">
                <button
                  type="button"
                  onClick={() => {
                    pendingConfirmationData.current = null
                    setDismissedConfirmationFor(state)
                  }}
                  className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
                >
                  Wróć do edycji
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={confirmSubstitutionWithoutReplacement}
                  className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:cursor-wait disabled:opacity-60"
                >
                  Tak, zapisz zejście
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
