'use client'

import type { DuplicatePerson } from '@/lib/db/people'

type Props = {
  duplicates: DuplicatePerson[]
  onContinue: () => void
  onCancel: () => void
}

function formatDate(date: string | null): string {
  if (!date) return '—'
  try {
    return new Date(date).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return date
  }
}

function displayName(person: DuplicatePerson): string {
  const full = [person.first_name, person.last_name].filter(Boolean).join(' ').trim()
  return full || person.nickname || '—'
}

export default function DuplicatePeopleWarning({ duplicates, onContinue, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-xl border border-amber-600/50 bg-neutral-950 p-6 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <svg
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div>
            <h3 className="text-base font-semibold text-amber-400">Możliwy duplikat</h3>
            <p className="mt-1 text-sm text-neutral-400">
              W bazie istnieją już osoby urodzone w tym samym kraju i tego samego dnia:
            </p>
          </div>
        </div>

        <ul className="mb-5 space-y-2">
          {duplicates.map((person) => (
            <li
              key={person.id}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5"
            >
              <a
                href={`/admin/people/${person.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-neutral-100 hover:text-amber-300 hover:underline"
              >
                {displayName(person)}
              </a>
              <p className="mt-0.5 text-xs text-neutral-500">
                {formatDate(person.birth_date)}
                {person.birth_country_name ? ` · ${person.birth_country_name}` : ''}
              </p>
            </li>
          ))}
        </ul>

        <p className="mb-5 text-sm text-neutral-400">
          Czy na pewno chcesz dodać nową osobę? Możesz kliknąć na powyższe osoby, żeby sprawdzić, czy to nie ta sama osoba.
        </p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
          >
            Wróć
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
          >
            Dodaj mimo to
          </button>
        </div>
      </div>
    </div>
  )
}
