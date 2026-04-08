'use client'

import Link from 'next/link'
import AdminSearchableTable from '@/components/admin/AdminSearchableTable'
import type { AdminTableColumn } from '@/components/admin/AdminTable'
import type { AdminCityListItem } from '@/lib/db/cities'

export default function CitiesSearchTable({ cities }: { cities: AdminCityListItem[] }) {
  const columns: AdminTableColumn<AdminCityListItem>[] = [
    {
      key: 'index',
      label: '#',
      render: (_, index) => index + 1,
      className: 'text-neutral-500',
    },
    {
      key: 'city_name',
      label: 'Miasto',
      render: (city) => (
        <Link
          href={`/admin/cities/${city.id}`}
          className="inline-flex rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
        >
          {city.city_name ?? '—'}
        </Link>
      ),
      className: 'font-medium',
    },
    {
      key: 'country',
      label: 'Kraj',
      render: (city) => city.country_name ?? '—',
      className: 'text-neutral-400',
    },
  ]

  return (
    <AdminSearchableTable
      data={cities}
      columns={columns}
      searchPlaceholder="Wpisz nazwę miasta albo kraju..."
      showHeader={false}
      emptyMessage="Brak miast w bazie danych."
      emptySearchMessage="Brak miast pasujących do wyszukiwanej frazy."
      getPrimaryText={(city) => city.city_name}
      getSecondaryTexts={(city) => [city.country_name]}
      filterConfig={{
        label: 'Kraj',
        allLabel: 'Wszystkie kraje',
        getValue: (city) => city.country_name,
      }}
      summaryText={(visible, total) =>
        `Wyświetlono ${visible} z ${total} miast. Kliknij nazwę miasta, aby przejść do strony szczegółów.`
      }
    />
  )
}