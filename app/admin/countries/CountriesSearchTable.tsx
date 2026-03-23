'use client'

import Link from 'next/link'
import AdminSearchableTable from '@/components/admin/AdminSearchableTable'
import type { AdminTableColumn } from '@/components/admin/AdminTable'
import type { AdminCountry } from '@/lib/db/countries'

export default function CountriesSearchTable({ countries }: { countries: AdminCountry[] }) {
  const columns: AdminTableColumn<AdminCountry>[] = [
    {
      key: 'index',
      label: '#',
      render: (_, index) => index + 1,
      className: 'text-neutral-500',
    },
    {
      key: 'name',
      label: 'Nazwa',
      render: (country) => (
        <Link
          href={`/admin/countries/${country.id}`}
          className="inline-flex rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
        >
          {country.name}
        </Link>
      ),
      className: 'font-medium',
    },
    {
      key: 'fifa_code',
      label: 'FIFA',
      render: (country) => country.fifa_code ?? '—',
      className: 'text-neutral-300',
    },
    {
      key: 'federation',
      label: 'Federacja',
      render: (country) => country.federation_short_name ?? '—',
      className: 'text-neutral-400',
    },
  ]

  return (
    <AdminSearchableTable
      data={countries}
      columns={columns}
      searchLabel="Wyszukaj kraj"
      searchPlaceholder="Wpisz nazwę kraju, kod FIFA albo federację..."
      priorityHint="Najpierw pokazują się kraje, których nazwa zaczyna się od wpisanej frazy, a potem pozostałe dopasowania."
      emptyMessage="Brak krajów."
      emptySearchMessage="Brak krajów pasujących do wyszukiwanej frazy."
      getPrimaryText={(country) => country.name}
      getSecondaryTexts={(country) => [country.fifa_code, country.federation_short_name]}
      filterConfig={{
        label: 'Federacja',
        allLabel: 'Wszystkie federacje',
        getValue: (country) => country.federation_short_name,
      }}
      filterWidthClass="md:w-[220px]"
      summaryText={(visible, total) =>
        `Wyświetlono ${visible} z ${total} krajów. Kliknij nazwę kraju, aby przejść do strony szczegółów.`
      }
    />
  )
}