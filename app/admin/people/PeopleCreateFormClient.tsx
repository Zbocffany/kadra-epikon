'use client'

import { useRef, useState } from 'react'
import type { AdminPersonBirthCityOption, DuplicatePerson } from '@/lib/db/people'
import type { AdminCountryOption } from '@/lib/db/cities'
import { checkDuplicatePeople, createPerson } from './actions'
import DuplicatePeopleWarning from '@/components/admin/DuplicatePeopleWarning'
import AdminCancelLink from '@/components/admin/AdminCancelLink'
import PersonBirthplaceFields from '@/components/admin/PersonBirthplaceFields'
import PersonRepresentedCountriesFields from '@/components/admin/PersonRepresentedCountriesFields'
import { createCityInline } from '@/app/admin/cities/actions'
import { createCountryInline } from '@/app/admin/countries/actions'

type Props = {
  cities: AdminPersonBirthCityOption[]
  countries: AdminCountryOption[]
}

export default function PeopleCreateFormClient({ cities, countries }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [duplicates, setDuplicates] = useState<DuplicatePerson[]>([])
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  const syncScope = 'admin-people-create'

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const form = e.currentTarget
    const formData = new FormData(form)

    const birthDate = (formData.get('birth_date') as string | null)?.trim() || null
    const birthCityId = (formData.get('birth_city_id') as string | null)?.trim() || null
    const birthCountryId = (formData.get('birth_country_id') as string | null)?.trim() || null

    if (birthDate) {
      setIsChecking(true)
      try {
        const found = await checkDuplicatePeople(birthDate, birthCityId, birthCountryId)
        if (found.length > 0) {
          setDuplicates(found)
          setPendingFormData(formData)
          return
        }
      } finally {
        setIsChecking(false)
      }
    }

    await createPerson(formData)
  }

  async function handleConfirmDespiteDuplicates() {
    if (!pendingFormData) return
    setDuplicates([])
    setPendingFormData(null)
    await createPerson(pendingFormData)
  }

  return (
    <>
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="first_name" className="text-sm font-medium text-neutral-300">Imię</label>
            <input
              id="first_name"
              name="first_name"
              type="text"
              autoComplete="off"
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="last_name" className="text-sm font-medium text-neutral-300">Nazwisko</label>
            <input
              id="last_name"
              name="last_name"
              type="text"
              autoComplete="off"
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="nickname" className="text-sm font-medium text-neutral-300">Pseudonim</label>
            <input
              id="nickname"
              name="nickname"
              type="text"
              autoComplete="off"
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            />
          </div>
        </div>

        <div className="mt-4">
          <PersonBirthplaceFields
            cities={cities}
            countries={countries}
            createCityAction={createCityInline}
            createCountryAction={createCountryInline}
            syncScope={syncScope}
          />
        </div>

        <div className="mt-4">
          <PersonRepresentedCountriesFields
            countries={countries}
            createCountryAction={createCountryInline}
            syncScope={syncScope}
          />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input id="is_active" name="is_active" type="checkbox" defaultChecked className="h-4 w-4" />
          <label htmlFor="is_active" className="text-sm text-neutral-300">Aktywna osoba</label>
        </div>

        <p className="mt-3 text-xs text-neutral-500">Wymagane jest przynajmniej jedno pole: imię, nazwisko lub pseudonim.</p>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="submit"
            disabled={isChecking}
            className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white disabled:opacity-50"
          >
            {isChecking ? 'Sprawdzanie...' : 'Dodaj osobę'}
          </button>
          <AdminCancelLink
            href="/admin/people"
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
          >
            Anuluj
          </AdminCancelLink>
        </div>
      </form>

      {duplicates.length > 0 && (
        <DuplicatePeopleWarning
          duplicates={duplicates}
          onContinue={handleConfirmDespiteDuplicates}
          onCancel={() => { setDuplicates([]); setPendingFormData(null) }}
        />
      )}
    </>
  )
}
