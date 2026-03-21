'use client'

import { useState, useMemo } from 'react'
import type { AdminPersonBirthCityOption } from '@/lib/db/people'
import type { AdminCountryOption } from '@/lib/db/cities'
import { addPerson } from '@/app/admin/matches/actions'

type AddPersonModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: (person: { id: string; label: string; firstName: string; lastName: string; nickname: string }) => void
  cities: AdminPersonBirthCityOption[]
  countries: AdminCountryOption[]
}

export default function AddPersonModal({
  isOpen,
  onClose,
  onSuccess,
  cities,
  countries,
}: AddPersonModalProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [nickname, setNickname] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [selectedCityId, setSelectedCityId] = useState('')
  const [selectedCountryId, setSelectedCountryId] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Build city-to-country mapping
  const cityCountryMap = useMemo(
    () => new Map(cities.map((city) => [city.id, city.current_country_id] as const)),
    [cities]
  )

  const handleCityChange = (cityId: string) => {
    setSelectedCityId(cityId)
    if (cityId) {
      const mappedCountryId = cityCountryMap.get(cityId) ?? ''
      setSelectedCountryId(mappedCountryId)
    }
  }

  async function handleAddPerson() {
    setError('')
    setIsLoading(true)

    try {
      const newPerson = await addPerson(
        firstName,
        lastName,
        nickname,
        birthDate || null,
        selectedCityId || null,
        selectedCountryId || null,
        isActive
      )
      setFirstName('')
      setLastName('')
      setNickname('')
      setBirthDate('')
      setSelectedCityId('')
      setSelectedCountryId('')
      setIsActive(true)
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

  const derivedCountryName = selectedCityId
    ? cities.find((city) => city.id === selectedCityId)?.current_country_name
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-neutral-100">Dodaj nową osobę</h2>

        <div className="space-y-4">
          {/* Imię, Nazwisko, Przydomek */}
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

          {/* Data urodzenia */}
          <div>
            <label htmlFor="birthDate" className="block text-sm font-medium text-neutral-300">
              Data urodzenia
            </label>
            <input
              id="birthDate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
              disabled={isLoading}
            />
          </div>

          {/* Miasto urodzenia */}
          <div>
            <label htmlFor="birthCity" className="block text-sm font-medium text-neutral-300">
              Miasto urodzenia
            </label>
            <select
              id="birthCity"
              value={selectedCityId}
              onChange={(e) => handleCityChange(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
              disabled={isLoading}
            >
              <option value="">— bez miasta —</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.city_name}
                </option>
              ))}
            </select>
          </div>

          {/* Kraj urodzenia */}
          <div>
            <label htmlFor="birthCountry" className="block text-sm font-medium text-neutral-300">
              Kraj urodzenia
            </label>
            <select
              id="birthCountry"
              value={selectedCountryId}
              onChange={(e) => setSelectedCountryId(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
              disabled={isLoading}
            >
              <option value="">— bez kraju —</option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
            {selectedCityId && (
              <p className="mt-1 text-xs text-neutral-500">
                Kraj uzupełnia się automatycznie z miasta
                {derivedCountryName ? ` (${derivedCountryName})` : ''}.
              </p>
            )}
            {!selectedCityId && (
              <p className="mt-1 text-xs text-neutral-500">
                Możesz ustawić sam kraj, jeśli miasto urodzenia jest nieznane.
              </p>
            )}
          </div>

          {/* Aktywny checkobx */}
          <div className="flex items-center gap-2 pt-2">
            <input
              id="isActive"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4"
              disabled={isLoading}
            />
            <label htmlFor="isActive" className="text-sm text-neutral-300">
              Aktywna osoba
            </label>
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
              type="button"
              onClick={handleAddPerson}
              disabled={isLoading}
              className="flex-1 rounded-md border border-neutral-600 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-100 hover:bg-neutral-700 disabled:opacity-50"
            >
              {isLoading ? 'Dodawanie...' : 'Dodaj'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
