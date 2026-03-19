'use client'

import { useEffect, useMemo, useRef, useState, useTransition, ReactNode } from 'react'
import type { InlineCreateState } from '@/lib/types/admin'

export type AdminSelectOption = {
  id: string
  label?: string
  short_name?: string
  [key: string]: unknown
}

interface AdminSelectFieldProps<T extends AdminSelectOption = AdminSelectOption> {
  name: string
  label: string
  selectedId?: string | null
  required?: boolean
  options: T[]
  displayKey: keyof Pick<T, 'label' | 'short_name'>
  placeholder?: string
  addButtonLabel: string
  addDialogTitle: string
  emptyResultsMessage: string
  createAction: (prevState: InlineCreateState, formData: FormData) => Promise<InlineCreateState>
  onSelectedIdChange?: (selectedId: string) => void
  /**
   * Custom form content to render inside the inline create dialog.
   * The dialog handles open/close buttons, so only render the form fields.
   */
  inlineForm: ReactNode
}

/**
 * Generic admin select field with inline creation capability.
 * Provides:
 * - Text search with smart filtering and sorting
 * - Dropdown selection (only shows on focus/typing)
 * - Inline create dialog with custom form content
 * - Support for different option types (label vs short_name display)
 *
 * Usage:
 * ```tsx
 * <AdminSelectField
 *   name="country_id"
 *   label="Kraj"
 *   options={countries}
 *   displayKey="label"
 *   addButtonLabel="+ Dodaj kraj"
 *   addDialogTitle="Nowy kraj"
 *   emptyResultsMessage="Brak wyników"
 *   createAction={createCountryInline}
 *   inlineForm={(
 *     <div className="space-y-3">
 *       <input name="name" type="text" required />
 *       <input name="fifa_code" type="text" />
 *     </div>
 *   )}
 * />
 * ```
 */
export default function AdminSelectField<T extends AdminSelectOption = AdminSelectOption>({
  name,
  label,
  selectedId,
  required,
  options,
  displayKey,
  placeholder,
  addButtonLabel,
  addDialogTitle,
  emptyResultsMessage,
  createAction,
  onSelectedIdChange,
  inlineForm,
}: AdminSelectFieldProps<T>) {
  const [allOptions, setAllOptions] = useState<T[]>(options)
  const [value, setValue] = useState(selectedId ?? '')
  const [query, setQuery] = useState(() => {
    if (!selectedId) return ''
    const selected = options.find((opt) => opt.id === selectedId)
    if (!selected) return ''
    const lbl = selected[displayKey]
    return typeof lbl === 'string' ? lbl : String(selected.label ?? selected.short_name ?? '')
  })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [createError, setCreateError] = useState<string | undefined>()
  const [isPending, startTransition] = useTransition()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inlineFormRef = useRef<HTMLDivElement>(null)

  function handleWrapperBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (!wrapperRef.current?.contains(e.relatedTarget as Node)) {
      setIsOpen(false)
    }
  }

  function getDisplayLabel(option: T): string {
    const label = option[displayKey]
    return typeof label === 'string' ? label : String(option.label || option.short_name || '—')
  }

  function handleInlineCreate() {
    if (!inlineFormRef.current || isPending) return
    const elems = inlineFormRef.current.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      'input[name], select[name]'
    )
    for (const el of elems) {
      if (!el.checkValidity()) {
        el.reportValidity()
        return
      }
    }
    const formData = new FormData()
    elems.forEach((el) => formData.append(el.name, el.value))
    setCreateError(undefined)
    startTransition(async () => {
      const result = await createAction({ ok: false, version: 0 }, formData)
      if (result.ok && result.id && result.label) {
        const newId = result.id
        const newLabel = result.label
        setAllOptions((prev) => {
          if (prev.some((opt) => opt.id === newId)) return prev
          const nextOpt = { id: newId, [displayKey]: newLabel } as T
          const next = [...prev, nextOpt]
          next.sort((a, b) => getDisplayLabel(a).localeCompare(getDisplayLabel(b), 'pl'))
          return next
        })
        setValue(newId)
        onSelectedIdChange?.(newId)
        setQuery(newLabel)
        setDialogOpen(false)
      } else {
        setCreateError(result.error)
      }
    })
  }

  useEffect(() => {
    setAllOptions(options)
  }, [options])

  useEffect(() => {
    setValue(selectedId ?? '')
  }, [selectedId])

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allOptions
    const matches = allOptions.filter((opt) => getDisplayLabel(opt).toLowerCase().includes(q))
    matches.sort((a, b) => {
      const aStarts = getDisplayLabel(a).toLowerCase().startsWith(q)
      const bStarts = getDisplayLabel(b).toLowerCase().startsWith(q)
      if (aStarts && !bStarts) return -1
      if (!aStarts && bStarts) return 1
      return getDisplayLabel(a).localeCompare(getDisplayLabel(b), 'pl')
    })
    return matches
  }, [allOptions, query])

  const defaultPlaceholder =
    placeholder || `Wpisz, aby filtrowac ${label.toLowerCase()}...`
  const selectedLabel = allOptions.find((o) => o.id === value)
  const selectedDisplay = selectedLabel ? getDisplayLabel(selectedLabel) : '—'

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-neutral-300">
        {label}
        {required ? ' *' : ''}
      </label>
      <input type="hidden" name={name} value={value} />

      <div ref={wrapperRef} onBlur={handleWrapperBlur} className="flex flex-col gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={defaultPlaceholder}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
        />

        {isOpen && filteredOptions.length > 0 && (
          <select
            value={value}
            onChange={(e) => {
              const id = e.target.value
              setValue(id)
              onSelectedIdChange?.(id)
              const selected = allOptions.find((opt) => opt.id === id)
              if (selected) setQuery(getDisplayLabel(selected))
              setIsOpen(false)
            }}
            size={Math.min(6, Math.max(3, filteredOptions.length))}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
          >
            {!required && <option value="">— brak —</option>}
            {required && <option value="">— wybierz —</option>}
            {filteredOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {getDisplayLabel(opt)}
              </option>
            ))}
          </select>
        )}
        {isOpen && query.trim() !== '' && filteredOptions.length === 0 && (
          <p className="text-xs text-neutral-500 px-1">{emptyResultsMessage}</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-neutral-500">Wybrane: {selectedDisplay}</p>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setIsOpen(false)
            setDialogOpen(true)
          }}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
        >
          {addButtonLabel}
        </button>
      </div>

      {dialogOpen && (
        <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-4">
          <p className="mb-3 text-sm font-semibold text-neutral-100">{addDialogTitle}</p>

          {createError && (
            <div className="mb-3 rounded-md border border-red-800 bg-red-950/50 px-3 py-2 text-xs text-red-300">
              {createError}
            </div>
          )}

          <div ref={inlineFormRef}>{inlineForm}</div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
            >
              Zamknij
            </button>
            <button
              type="button"
              onClick={handleInlineCreate}
              disabled={isPending}
              className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white disabled:opacity-50"
            >
              {isPending ? 'Zapisywanie...' : 'Dodaj i wybierz'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
