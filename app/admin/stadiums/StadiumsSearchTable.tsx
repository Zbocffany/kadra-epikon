'use client'

import Link from 'next/link'
import AdminSearchableTable from '@/components/admin/AdminSearchableTable'
import type { AdminTableColumn } from '@/components/admin/AdminTable'
import type { AdminStadiumListItem } from '@/lib/db/stadiums'

export default function StadiumsSearchTable({ stadiums }: { stadiums: AdminStadiumListItem[] }) {
  const columns: AdminTableColumn<AdminStadiumListItem>[] = [
    {
      key: 'index',
      label: '#',
      render: (_, index) => index + 1,
      className: 'text-neutral-500',
    },
    {
      key: 'name',
      label: 'Stadion',
      render: (stadium) => (
        <Link
          href={`/admin/stadiums/${stadium.id}`}
          className="inline-flex rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
        >
          {stadium.name ?? '-'}
        </Link>
      ),
      className: 'font-medium',
    },
    {
      key: 'city',
      label: 'Miasto',
      render: (stadium) => stadium.city_name ?? '-',
      className: 'text-neutral-300',
    },
    {
      key: 'country',
      label: 'Kraj',
      render: (stadium) => stadium.country_name ?? '-',
      className: 'text-neutral-400',
    },
  ]

  return (
    <AdminSearchableTable
      data={stadiums}
      columns={columns}
      searchPlaceholder="Wpisz nazwę stadionu, miasto albo kraj..."
      showHeader={false}
      emptyMessage="Brak stadionów w bazie danych."
      emptySearchMessage="Brak stadionów pasujących do wyszukiwanej frazy."
      getPrimaryText={(stadium) => stadium.name}
      getSecondaryTexts={(stadium) => [stadium.city_name, stadium.country_name]}
      filterConfig={{
        label: 'Kraj',
        allLabel: 'Wszystkie kraje',
        getValue: (stadium) => stadium.country_name,
      }}
      secondaryFilterConfig={{
        label: 'Miasto',
        allLabel: 'Wszystkie miasta',
        getValue: (stadium) => stadium.city_name,
      }}
      filterWidthClass="md:w-56"
      secondaryFilterWidthClass="md:w-56"
      summaryText={(visible, total) =>
        `Wyświetlono ${visible} z ${total} stadionów. Kliknij nazwę stadionu, aby przejść do strony szczegółów.`
      }
    />
  )
}