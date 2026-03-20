import Link from 'next/link'
import type { RawSearchParams } from '@/lib/pagination'

type AdminPaginationProps = {
  basePath: string
  searchParams: RawSearchParams
  page: number
  pageSize: number
  totalPages: number
  totalItems: number
  from: number
  to: number
  itemLabel: string
}

function buildPageHref(basePath: string, searchParams: RawSearchParams, page: number): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'page') continue
    if (value === undefined) continue

    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item)
      }
    } else {
      params.set(key, value)
    }
  }

  params.set('page', String(page))
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

export default function AdminPagination({
  basePath,
  searchParams,
  page,
  pageSize,
  totalPages,
  totalItems,
  from,
  to,
  itemLabel,
}: AdminPaginationProps) {
  if (totalItems === 0) {
    return null
  }

  const windowStart = Math.max(1, page - 2)
  const windowEnd = Math.min(totalPages, page + 2)
  const pages = Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => windowStart + i)

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-neutral-800 bg-neutral-900/50 px-4 py-3 text-xs text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
      <p>
        Pokazano {from}-{to} z {totalItems} {itemLabel}. Strona {page} z {totalPages}. ({pageSize}/stronę)
      </p>

      <nav className="flex items-center gap-1" aria-label="Paginacja">
        <Link
          href={buildPageHref(basePath, searchParams, Math.max(1, page - 1))}
          aria-disabled={page <= 1}
          className={`rounded border px-2 py-1 ${
            page <= 1
              ? 'pointer-events-none border-neutral-800 text-neutral-600'
              : 'border-neutral-700 text-neutral-200 hover:bg-neutral-800'
          }`}
        >
          Poprzednia
        </Link>

        {pages.map((pageNumber) => (
          <Link
            key={pageNumber}
            href={buildPageHref(basePath, searchParams, pageNumber)}
            aria-current={pageNumber === page ? 'page' : undefined}
            className={`rounded border px-2 py-1 ${
              pageNumber === page
                ? 'border-neutral-300 bg-neutral-100 text-neutral-900'
                : 'border-neutral-700 text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            {pageNumber}
          </Link>
        ))}

        <Link
          href={buildPageHref(basePath, searchParams, Math.min(totalPages, page + 1))}
          aria-disabled={page >= totalPages}
          className={`rounded border px-2 py-1 ${
            page >= totalPages
              ? 'pointer-events-none border-neutral-800 text-neutral-600'
              : 'border-neutral-700 text-neutral-200 hover:bg-neutral-800'
          }`}
        >
          Następna
        </Link>
      </nav>
    </div>
  )
}
