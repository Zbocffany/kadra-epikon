'use client'

import { startTransition, useActionState, useEffect, useRef, useState, type ReactNode } from 'react'
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
  const [dismissedErrors, setDismissedErrors] = useState(false)
  const [dismissedPlain, setDismissedPlain] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  // Reset dismissal flags whenever a new server response comes in.
  useEffect(() => {
    setDismissedErrors(false)
    setDismissedPlain(false)
  }, [state])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    // If the submitter has its own formAction (e.g. the Delete button), let
    // React/browser handle that server action natively — don't intercept.
    if (submitter && submitter.getAttribute('formaction')) return
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    if (submitter?.name) formData.append(submitter.name, submitter.value ?? '')
    startTransition(() => dispatch(formData))
  }

  const errors = state?.errors ?? []
  const plainError = state?.plainError ?? null
  const showModal = errors.length > 0 && !dismissedErrors

  return (
    <>
      <form ref={formRef} onSubmit={handleSubmit} aria-busy={isPending}>
        {plainError && !dismissedPlain && (
          <div className="mb-6 flex items-start justify-between gap-3 rounded-lg border border-red-800 bg-red-950/50 px-5 py-4 text-sm text-red-300">
            <span>{plainError}</span>
            <button
              type="button"
              onClick={() => setDismissedPlain(true)}
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
          onAcknowledge={() => setDismissedErrors(true)}
        />
      )}
    </>
  )
}
