import type { RawSearchParams } from '@/lib/pagination'

export function toSearchString(params: RawSearchParams): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') search.set(key, value)
    else if (Array.isArray(value) && value[0]) search.set(key, value[0])
  }
  return search.toString()
}
