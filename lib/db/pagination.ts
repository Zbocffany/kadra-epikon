export type PaginatedDbResult<T> = {
  items: T[]
  total: number
}

export function getPageRange(page: number, pageSize: number): {
  from: number
  to: number
} {
  const safePage = Math.max(1, page)
  const safePageSize = Math.max(1, pageSize)

  return {
    from: (safePage - 1) * safePageSize,
    to: safePage * safePageSize - 1,
  }
}

/**
 * PostgREST returns at most 1000 rows by default. For queries whose result set
 * may legitimately exceed that cap, use this helper to page through the result
 * with .range(from, to) until the page comes back smaller than PAGE_SIZE.
 *
 * The caller's `buildQuery(from, to)` MUST apply a stable .order() and call
 * .range(from, to) — otherwise pages may overlap or skip rows.
 *
 * Example:
 *   const rows = await fetchAllRows<{ id: string }>((from, to) =>
 *     supabase.from('tbl_People').select('id').order('id').range(from, to)
 *   )
 */
export const PG_PAGE_SIZE = 1000

export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize: number = PG_PAGE_SIZE
): Promise<T[]> {
  const out: T[] = []
  let from = 0
  // Cap iterations defensively to avoid runaway loops in case of caller bugs.
  for (let iter = 0; iter < 10_000; iter++) {
    const { data, error } = await buildQuery(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < pageSize) return out
    from += pageSize
  }
  throw new Error('fetchAllRows: exceeded maximum page iterations (data set too large?)')
}
