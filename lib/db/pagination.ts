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
