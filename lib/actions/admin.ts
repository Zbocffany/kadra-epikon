import { redirect } from 'next/navigation'
import type { InlineCreateState } from '@/lib/types/admin'

type DbError = {
  code?: string
  message: string
}

function withQueryParam(path: string, key: string, value: string): string {
  const [pathWithSearch, hash = ''] = path.split('#', 2)
  const [pathname, search = ''] = pathWithSearch.split('?', 2)
  const params = new URLSearchParams(search)
  params.set(key, value)

  const nextPath = `${pathname}?${params.toString()}`
  return hash ? `${nextPath}#${hash}` : nextPath
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
  redirect(withQueryParam(path, 'error', message))
}

export function redirectWithAdded(path: string, value: string): never {
  redirect(withQueryParam(path, 'added', value))
}

export function redirectWithSaved(path: string): never {
  redirect(withQueryParam(path, 'saved', '1'))
}

export function inlineError(prevState: InlineCreateState, message: string): InlineCreateState {
  return {
    ok: false,
    error: message,
    version: prevState.version + 1,
  }
}

export function inlineWarning(prevState: InlineCreateState, message: string): InlineCreateState {
  return {
    ok: false,
    warning: message,
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

