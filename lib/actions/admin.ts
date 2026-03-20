import { redirect } from 'next/navigation'
import type { InlineCreateState } from '@/lib/types/admin'

type DbError = {
  code?: string
  message: string
}

export function getTrimmedString(formData: FormData, key: string): string {
  const raw = formData.get(key)
  return typeof raw === 'string' ? raw.trim() : ''
}

export function getTrimmedNullable(formData: FormData, key: string): string | null {
  const value = getTrimmedString(formData, key)
  return value ? value : null
}

export function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`)
}

export function redirectWithAdded(path: string, value: string): never {
  redirect(`${path}?added=${encodeURIComponent(value)}`)
}

export function redirectWithSaved(path: string): never {
  redirect(`${path}?saved=1`)
}

export function inlineError(prevState: InlineCreateState, message: string): InlineCreateState {
  return {
    ok: false,
    error: message,
    version: prevState.version + 1,
  }
}

export function inlineSuccess(
  prevState: InlineCreateState,
  id: string,
  label: string
): InlineCreateState {
  return {
    ok: true,
    id,
    label,
    version: prevState.version + 1,
  }
}

export function mapDbError(error: DbError, duplicateMessage: string): string {
  if (error.code === '23505') {
    return duplicateMessage
  }
  return 'Wystąpił błąd bazy danych. Spróbuj ponownie.'
}

