/**
 * Shared types for admin panel
 */

// ─── Inline Create State ──────────────────────────────────────────────────────
export type InlineCreateState = {
  ok: boolean
  id?: string
  label?: string
  error?: string
  warning?: string
  version: number
}

// ─── Select Field Options ─────────────────────────────────────────────────────
export type SelectOption = {
  id: string
  label: string
}

export type SelectOptionWithShortName = {
  id: string
  short_name: string
}

// ─── Delete Form State ────────────────────────────────────────────────────────
export type DeleteFormState = {
  id: string
}

// ─── Page Props ───────────────────────────────────────────────────────────────
export type DetailPageParams = Promise<{ id: string }>
export type DetailPageSearchParams = Promise<{
  mode?: string
  saved?: string
  error?: string
}>

export type ListPageSearchParams = Promise<{
  added?: string
  error?: string
}>
