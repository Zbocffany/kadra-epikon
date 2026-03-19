'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type StatusTone = 'success' | 'error'

type StatusPayload = {
  tone: StatusTone
  message: string
}

function resolveStatus(added: string | null, saved: string | null, error: string | null): StatusPayload | null {
  if (error) {
    return { tone: 'error', message: error }
  }

  if (added) {
    const message = added.startsWith('Usunięto ') ? added : `Dodano: ${added}`
    return { tone: 'success', message }
  }

  if (saved === '1') {
    return { tone: 'success', message: 'Zmiany zostały zapisane.' }
  }

  return null
}

export default function AdminStatusBar() {
  const searchParams = useSearchParams()

  const status = useMemo(
    () => resolveStatus(searchParams.get('added'), searchParams.get('saved'), searchParams.get('error')),
    [searchParams]
  )

  const statusKey = status ? `${status.tone}:${status.message}` : null
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)

  useEffect(() => {
    if (statusKey && statusKey !== dismissedKey) {
      setDismissedKey(null)
    }
  }, [dismissedKey, statusKey])

  useEffect(() => {
    if (!status || status.tone !== 'success' || !statusKey) {
      return
    }

    const timerId = window.setTimeout(() => {
      setDismissedKey(statusKey)
    }, 10000)

    return () => window.clearTimeout(timerId)
  }, [status, statusKey])

  if (!status || dismissedKey === statusKey) {
    return null
  }

  const toneClasses = status.tone === 'error'
    ? 'border-red-700 bg-red-950/90 text-red-200'
    : 'border-emerald-700 bg-emerald-950/90 text-emerald-200'

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] px-4 pb-4 sm:px-8" role="status" aria-live="polite">
      <div className={`pointer-events-auto mx-auto flex w-full max-w-6xl items-start justify-between gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur ${toneClasses}`}>
        <p className="text-sm leading-6">{status.message}</p>
        <button
          type="button"
          aria-label="Zamknij komunikat"
          onClick={() => {
            if (statusKey) {
              setDismissedKey(statusKey)
            }
          }}
          className="rounded-md border border-neutral-700/70 bg-neutral-900/80 px-2 py-1 text-xs font-semibold text-neutral-100 hover:bg-neutral-800"
        >
          X
        </button>
      </div>
    </div>
  )
}