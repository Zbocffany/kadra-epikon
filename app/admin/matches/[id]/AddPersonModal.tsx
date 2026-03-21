'use client'

import { useState } from 'react'
import { addPerson } from '@/app/admin/matches/actions'

type AddPersonModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: (person: { id: string; label: string; firstName: string; lastName: string; nickname: string }) => void
}

export default function AddPersonModal({ isOpen, onClose, onSuccess }: AddPersonModalProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [nickname, setNickname] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const newPerson = await addPerson(firstName, lastName, nickname)
      setFirstName('')
      setLastName('')
      setNickname('')
      onSuccess(newPerson)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nie udało się dodać osoby.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-neutral-700 bg-neutral-900 p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-neutral-100">Dodaj nową osobę</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-neutral-300">
              Imię
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500"
              placeholder="Np. Jan"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-neutral-300">
              Nazwisko
            </label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500"
              placeholder="Np. Kowalski"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="nickname" className="block text-sm font-medium text-neutral-300">
              Przydomek
            </label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500"
              placeholder="Np. Kowal"
              disabled={isLoading}
            />
          </div>

          {error && <div className="rounded-md bg-red-900/30 p-3 text-sm text-red-300">{error}</div>}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 rounded-md border border-neutral-600 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-100 hover:bg-neutral-700 disabled:opacity-50"
            >
              {isLoading ? 'Dodawanie...' : 'Dodaj'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
