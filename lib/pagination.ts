export const DEFAULT_PAGE_SIZE = 25
export const MAX_PAGE_SIZE = 100

export type RawSearchParams = Record<string, string | string[] | undefined>

export function parsePositiveInt(value: string | string[] | undefined, fallback: number): number {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = Number.parseInt(raw ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function parsePaginationParams(searchParams: RawSearchParams): {
  page: number
  pageSize: number
} {
  const page = parsePositiveInt(searchParams.page, 1)
  const requestedPageSize = parsePositiveInt(searchParams.pageSize, DEFAULT_PAGE_SIZE)
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE)

  return { page, pageSize }
}

export function getPaginationMeta(total: number, page: number, pageSize: number): {
  total: number
  page: number
  pageSize: number
  totalPages: number
  from: number
  to: number
} {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(page, 1), totalPages)

  if (total === 0) {
    return {
      total,
      page: safePage,
      pageSize,
      totalPages,
      from: 0,
      to: 0,
    }
  }

  const from = (safePage - 1) * pageSize + 1
  const to = Math.min(safePage * pageSize, total)

  return {
    total,
    page: safePage,
    pageSize,
    totalPages,
    from,
    to,
  }
}
