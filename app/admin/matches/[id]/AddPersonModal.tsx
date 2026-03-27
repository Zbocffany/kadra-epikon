'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { AdminPersonBirthCityOption, DuplicatePerson } from '@/lib/db/people'
import type { AdminCountryOption } from '@/lib/db/cities'
import type { AdminFederation } from '@/lib/db/countries'
import { addPerson, checkDuplicatePeople } from '@/app/admin/matches/actions'
import DuplicatePeopleWarning from '@/components/admin/DuplicatePeopleWarning'
import { createCityInline } from '@/app/admin/cities/actions'
import { createCountryInline } from '@/app/admin/countries/actions'
import AdminSelectField from '@/components/admin/AdminSelectField'
import { VOIVODESHIP_OPTIONS } from '@/lib/constants/voivodeships'

const MATCH_CITY_CREATED_EVENT = 'match:city-created'
const MATCH_COUNTRY_CREATED_EVENT = 'match:country-created'

type AddPersonModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: (person: { id: string; label: string; firstName: string; lastName: string; nickname: string }) => void
  cities: AdminPersonBirthCityOption[]
  countries: AdminCountryOption[]
  federations: AdminFederation[]
}

export default function AddPersonModal({
  isOpen,
  onClose,
  onSuccess,
  cities,
  countries,
  federations,
}: AddPersonModalProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [nickname, setNickname] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [selectedCityId, setSelectedCityId] = useState('')
  const [selectedCountryId, setSelectedCountryId] = useState('')
  const [selectedRepresentedCountryId, setSelectedRepresentedCountryId] = useState('')
  const [isRepresentedCountryTouched, setIsRepresentedCountryTouched] = useState(false)
  const [cityOptions, setCityOptions] = useState<AdminPersonBirthCityOption[]>(cities)
  const [countryOptions, setCountryOptions] = useState<AdminCountryOption[]>(countries)
  const pendingCityCountryIdRef = useRef('')
  const [isActive, setIsActive] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [duplicates, setDuplicates] = useState<DuplicatePerson[]>([])
  const [pendingPersonData, setPendingPersonData] = useState<null | {
    firstName: string
    lastName: string
    nickname: string
    birthDate: string | null
    cityId: string | null
    countryId: string | null
    representedCountryIds: string[]
    isActive: boolean
  }>(null)

  useEffect(() => {
    setCityOptions(cities)
  }, [cities])

  useEffect(() => {
    setCountryOptions(countries)
  }, [countries])

  useEffect(() => {
    function handleExternalCityCreated(event: Event) {
      const customEvent = event as CustomEvent<AdminPersonBirthCityOption>
      const createdCity = customEvent.detail

      if (!createdCity) return

      setCityOptions((prev) => {
        if (prev.some((city) => city.id === createdCity.id)) {
          return prev
        }

        return [...prev, createdCity].sort((a, b) => a.city_name.localeCompare(b.city_name, 'pl'))
      })
    }

    function handleExternalCountryCreated(event: Event) {
      const customEvent = event as CustomEvent<AdminCountryOption>
      const createdCountry = customEvent.detail

      if (!createdCountry) return

      setCountryOptions((prev) => {
        if (prev.some((country) => country.id === createdCountry.id)) {
          return prev
        }

        return [...prev, createdCountry].sort((a, b) => a.name.localeCompare(b.name, 'pl'))
      })
    }

    window.addEventListener(MATCH_CITY_CREATED_EVENT, handleExternalCityCreated)
    window.addEventListener(MATCH_COUNTRY_CREATED_EVENT, handleExternalCountryCreated)

    return () => {
      window.removeEventListener(MATCH_CITY_CREATED_EVENT, handleExternalCityCreated)
      window.removeEventListener(MATCH_COUNTRY_CREATED_EVENT, handleExternalCountryCreated)
    }
  }, [])

  // Build city-to-country mapping
  const cityCountryMap = useMemo(
    () => new Map(cityOptions.map((city) => [city.id, city.current_country_id] as const)),
    [cityOptions]
  )

  useEffect(() => {
    if (isRepresentedCountryTouched) return
    setSelectedRepresentedCountryId(selectedCountryId)
  }, [selectedCountryId, isRepresentedCountryTouched])

  const handleCityChange = (cityId: string) => {
    setSelectedCityId(cityId)

    if (!cityId) {
      setSelectedCountryId('')
      if (!isRepresentedCountryTouched) {
        setSelectedRepresentedCountryId('')
      }
      return
    }

    const mappedCountryId = cityCountryMap.get(cityId)

    // City can be freshly created and not yet present in cityCountryMap in this tick.
    if (mappedCountryId === undefined) {
      return
    }

    const nextCountryId = mappedCountryId ?? ''
    setSelectedCountryId(nextCountryId)
    if (!isRepresentedCountryTouched) {
      setSelectedRepresentedCountryId(nextCountryId)
    }
  }

  const handlePendingCityCountryChange = (countryId: string) => {
    pendingCityCountryIdRef.current = countryId
  }

  const handleBirthCountryChange = (countryId: string) => {
    setSelectedCountryId(countryId)
  }

  const handleRepresentedCountryChange = (countryId: string) => {
    setIsRepresentedCountryTouched(true)
    setSelectedRepresentedCountryId(countryId)
  }

  async function doAddPerson(
    fName: string,
    lName: string,
    nick: string,
    bDate: string | null,
    cityId: string | null,
    countryId: string | null,
    representedCountryIds: string[],
    active: boolean
  ) {
    setError('')
    setIsLoading(true)

    try {
      const newPerson = await addPerson(fName, lName, nick, bDate, cityId, countryId, representedCountryIds, active)
      setFirstName('')
      setLastName('')
      setNickname('')
      setBirthDate('')
      setSelectedCityId('')
      setSelectedCountryId('')
      setSelectedRepresentedCountryId('')
      setIsRepresentedCountryTouched(false)
      setIsActive(true)
      setPendingPersonData(null)
      setDuplicates([])
      onSuccess(newPerson)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nie udało się dodać osoby.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleAddPerson() {
    setError('')

    if (birthDate && selectedCountryId) {
      const found = await checkDuplicatePeople(birthDate, selectedCountryId)
      if (found.length > 0) {
        setDuplicates(found)
        setPendingPersonData({
          firstName,
          lastName,
          nickname,
          birthDate: birthDate || null,
          cityId: selectedCityId || null,
          countryId: selectedCountryId || null,
          representedCountryIds: selectedRepresentedCountryId ? [selectedRepresentedCountryId] : [],
          isActive,
        })
        return
      }
    }

    await doAddPerson(
      firstName,
      lastName,
      nickname,
      birthDate || null,
      selectedCityId || null,
      selectedCountryId || null,
      selectedRepresentedCountryId ? [selectedRepresentedCountryId] : [],
      isActive
    )
  }

  async function handleConfirmDespiteDuplicates() {
    if (!pendingPersonData) return
    const { firstName: fN, lastName: lN, nickname: nN, birthDate: bD, cityId, countryId, representedCountryIds, isActive: active } = pendingPersonData
    await doAddPerson(fN, lN, nN, bD, cityId, countryId, representedCountryIds, active)
  }

  if (!isOpen) return null

  const derivedCountryName = selectedCityId
    ? cityOptions.find((city) => city.id === selectedCityId)?.current_country_name
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
          <AdminSelectField
            name="birth_city_id"
            label="Miasto urodzenia"
            disabled={isLoading}
            selectedId={selectedCityId}
            emptyOptionLabel="- brak -"
            options={cityOptions.map((city) => ({ id: city.id, label: city.city_name }))}
            displayKey="label"
            placeholder="Wpisz, aby filtrować miasta..."
            addButtonLabel="+ Dodaj miasto"
            addDialogTitle="Nowe miasto"
            emptyResultsMessage="Brak wyników - możesz dodać nowe miasto poniżej."
            createAction={createCityInline}
            onSelectedIdChange={handleCityChange}
            onOptionCreated={(option) => {
              const createdCountryId = pendingCityCountryIdRef.current || null
              const countryName = createdCountryId
                ? countryOptions.find((country) => country.id === createdCountryId)?.name ?? null
                : null
              const createdCity: AdminPersonBirthCityOption = {
                id: option.id,
                city_name: option.label ?? '—',
                current_country_id: createdCountryId,
                current_country_name: countryName,
              }

              setCityOptions((prev) => {
                if (prev.some((city) => city.id === option.id)) {
                  return prev
                }

                return [...prev, createdCity].sort((a, b) => a.city_name.localeCompare(b.city_name, 'pl'))
              })

              window.dispatchEvent(
                new CustomEvent<AdminPersonBirthCityOption>(MATCH_CITY_CREATED_EVENT, {
                  detail: createdCity,
                })
              )

              if (createdCountryId) {
                setSelectedCountryId(createdCountryId)
                if (!isRepresentedCountryTouched) {
                  setSelectedRepresentedCountryId(createdCountryId)
                }
              }

              pendingCityCountryIdRef.current = ''
            }}
            inlineForm={(
              <div className="space-y-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="inline_add_person_city_name" className="text-xs text-neutral-400">
                    Nazwa miasta
                  </label>
                  <input
                    id="inline_add_person_city_name"
                    name="city_name"
                    type="text"
                    required
                    className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                  />
                </div>

                <AdminSelectField
                  name="country_id"
                  label="Kraj"
                  required
                  options={countryOptions.map((country) => ({ id: country.id, label: country.name }))}
                  displayKey="label"
                  placeholder="Wpisz, aby filtrować kraje..."
                  addButtonLabel="+ Dodaj kraj"
                  addDialogTitle="Nowy kraj"
                  emptyResultsMessage="Brak wyników - możesz dodać nowy kraj poniżej."
                  createAction={createCountryInline}
                  onSelectedIdChange={handlePendingCityCountryChange}
                  onOptionCreated={(option) => {
                    const createdCountry = { id: option.id, name: option.label ?? '—' }

                    setCountryOptions((prev) => {
                      if (prev.some((country) => country.id === option.id)) {
                        return prev
                      }

                      return [...prev, createdCountry]
                        .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
                    })

                    window.dispatchEvent(
                      new CustomEvent<AdminCountryOption>(MATCH_COUNTRY_CREATED_EVENT, {
                        detail: createdCountry,
                      })
                    )

                    handlePendingCityCountryChange(option.id)
                  }}
                  inlineForm={(
                    <div className="space-y-3">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="inline_add_person_country_name" className="text-xs text-neutral-400">
                          Nazwa kraju
                        </label>
                        <input
                          id="inline_add_person_country_name"
                          name="name"
                          type="text"
                          required
                          className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="inline_add_person_country_fifa" className="text-xs text-neutral-400">
                          Kod FIFA
                        </label>
                        <input
                          id="inline_add_person_country_fifa"
                          name="fifa_code"
                          type="text"
                          maxLength={3}
                          className="uppercase rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="inline_add_person_country_federation" className="text-xs text-neutral-400">
                          Federacja
                        </label>
                        <select
                          id="inline_add_person_country_federation"
                          name="federation_id"
                          className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                        >
                          <option value="">— brak —</option>
                          {federations.map((federation) => (
                            <option key={federation.id} value={federation.id}>
                              {federation.short_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                />

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="inline_add_person_city_voivodeship" className="text-xs text-neutral-400">
                    Województwo (tylko Polska)
                  </label>
                  <select
                    id="inline_add_person_city_voivodeship"
                    name="voivodeship"
                    className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                  >
                    <option value="">- brak -</option>
                    {VOIVODESHIP_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          />

          {/* Kraj urodzenia */}
          <div className="flex flex-col gap-1.5">
            <AdminSelectField
              name="birth_country_id"
              label="Kraj urodzenia"
              disabled={isLoading}
              selectedId={selectedCountryId}
              emptyOptionLabel="- brak -"
              options={countryOptions.map((country) => ({ id: country.id, label: country.name }))}
              displayKey="label"
              placeholder="Wpisz, aby filtrować kraje..."
              addButtonLabel="+ Dodaj kraj"
              addDialogTitle="Nowy kraj"
              emptyResultsMessage="Brak wyników - możesz dodać nowy kraj poniżej."
              createAction={createCountryInline}
              onSelectedIdChange={handleBirthCountryChange}
              onOptionCreated={(option) => {
                const createdCountry = { id: option.id, name: option.label ?? '—' }

                setCountryOptions((prev) => {
                  if (prev.some((country) => country.id === option.id)) {
                    return prev
                  }

                  return [...prev, createdCountry]
                    .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
                })

                window.dispatchEvent(
                  new CustomEvent<AdminCountryOption>(MATCH_COUNTRY_CREATED_EVENT, {
                    detail: createdCountry,
                  })
                )

                setSelectedCountryId(option.id)
              }}
              inlineForm={(
                <div className="space-y-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="inline_add_person_birth_country_name" className="text-xs text-neutral-400">
                      Nazwa kraju
                    </label>
                    <input
                      id="inline_add_person_birth_country_name"
                      name="name"
                      type="text"
                      required
                      className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="inline_add_person_birth_country_fifa" className="text-xs text-neutral-400">
                      Kod FIFA
                    </label>
                    <input
                      id="inline_add_person_birth_country_fifa"
                      name="fifa_code"
                      type="text"
                      maxLength={3}
                      className="uppercase rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="inline_add_person_birth_country_federation" className="text-xs text-neutral-400">
                      Federacja
                    </label>
                    <select
                      id="inline_add_person_birth_country_federation"
                      name="federation_id"
                      className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                    >
                      <option value="">— brak —</option>
                      {federations.map((federation) => (
                        <option key={federation.id} value={federation.id}>
                          {federation.short_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            />

            <AdminSelectField
              name="represented_country_id"
              label="Reprezentowany kraj"
              disabled={isLoading}
              selectedId={selectedRepresentedCountryId}
              emptyOptionLabel="- brak -"
              options={countryOptions.map((country) => ({ id: country.id, label: country.name }))}
              displayKey="label"
              placeholder="Wpisz, aby filtrować kraje..."
              addButtonLabel="+ Dodaj kraj"
              addDialogTitle="Nowy kraj"
              emptyResultsMessage="Brak wyników - możesz dodać nowy kraj poniżej."
              createAction={createCountryInline}
              onSelectedIdChange={handleRepresentedCountryChange}
              onOptionCreated={(option) => {
                setCountryOptions((prev) => {
                  if (prev.some((country) => country.id === option.id)) {
                    return prev
                  }

                  return [...prev, { id: option.id, name: option.label ?? '—' }]
                    .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
                })

                setIsRepresentedCountryTouched(true)
                setSelectedRepresentedCountryId(option.id)
              }}
              inlineForm={(
                <div className="space-y-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="inline_add_person_represented_country_name" className="text-xs text-neutral-400">
                      Nazwa kraju
                    </label>
                    <input
                      id="inline_add_person_represented_country_name"
                      name="name"
                      type="text"
                      required
                      className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="inline_add_person_represented_country_fifa" className="text-xs text-neutral-400">
                      Kod FIFA
                    </label>
                    <input
                      id="inline_add_person_represented_country_fifa"
                      name="fifa_code"
                      type="text"
                      maxLength={3}
                      className="uppercase rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="inline_add_person_represented_country_federation" className="text-xs text-neutral-400">
                      Federacja
                    </label>
                    <select
                      id="inline_add_person_represented_country_federation"
                      name="federation_id"
                      className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                    >
                      <option value="">— brak —</option>
                      {federations.map((federation) => (
                        <option key={federation.id} value={federation.id}>
                          {federation.short_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            />

            {!isRepresentedCountryTouched && selectedCountryId && (
              <p className="mt-1 text-xs text-neutral-500">
                Domyślnie ustawiono kraj urodzenia jako reprezentowany.
              </p>
            )}

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

      {duplicates.length > 0 && (
        <DuplicatePeopleWarning
          duplicates={duplicates}
          onContinue={handleConfirmDespiteDuplicates}
          onCancel={() => { setDuplicates([]); setPendingPersonData(null) }}
        />
      )}
    </div>
  )
}
