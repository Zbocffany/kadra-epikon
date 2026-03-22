'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, ReactNode } from 'react'
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
  hideLabel?: boolean
  selectedId?: string | null
  disabled?: boolean
  required?: boolean
  emptyOptionLabel?: string
  options: T[]
  displayKey: keyof Pick<T, 'label' | 'short_name'>
  placeholder?: string
  addButtonLabel?: string
  addDialogTitle?: string
  emptyResultsMessage?: string
  createAction?: (prevState: InlineCreateState, formData: FormData) => Promise<InlineCreateState>
  onSelectedIdChange?: (selectedId: string) => void
  onOptionCreated?: (option: T) => void
  /**
   * Custom form content to render inside the inline create dialog.
   * The dialog handles open/close buttons, so only render the form fields.
   */
  inlineForm?: ReactNode
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
  hideLabel,
  selectedId,
  disabled,
  required,
  emptyOptionLabel,
  options,
  displayKey,
  placeholder,
  addButtonLabel,
  addDialogTitle,
  emptyResultsMessage,
  createAction,
  onSelectedIdChange,
  onOptionCreated,
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
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [createError, setCreateError] = useState<string | undefined>()
  const [isPending, startTransition] = useTransition()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inlineFormRef = useRef<HTMLDivElement>(null)

  function handleWrapperBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (!wrapperRef.current?.contains(e.relatedTarget as Node)) {
      setIsOpen(false)
      // Reset query to reflect actual selected value (discard abandoned search text)
      const selected = allOptions.find((opt) => opt.id === value)
      setQuery(selected ? getDisplayLabel(selected) : '')
    }
  }

  const getDisplayLabel = useCallback((option: T): string => {
    const label = option[displayKey]
    return typeof label === 'string' ? label : String(option.label || option.short_name || '—')
  }, [displayKey])

  function handleInlineCreate() {
    if (!createAction || !inlineFormRef.current || isPending) return
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
        const nextOpt = { id: newId, [displayKey]: newLabel } as T
        setAllOptions((prev) => {
          if (prev.some((opt) => opt.id === newId)) return prev
          const next = [...prev, nextOpt]
          next.sort((a, b) => getDisplayLabel(a).localeCompare(getDisplayLabel(b), 'pl'))
          return next
        })
        onOptionCreated?.(nextOpt)
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

  // Prefill first input field with search query when dialog opens
  useEffect(() => {
    if (!dialogOpen || !inlineFormRef.current || !query.trim()) return
    
    const inputs = inlineFormRef.current.querySelectorAll<HTMLInputElement>('input[name]')
    if (inputs.length > 0) {
      inputs[0].value = query
      inputs[0].focus()
    }
  }, [dialogOpen, query])

  useEffect(() => {
    const id = selectedId ?? ''
    setValue(id)
    if (!id) {
      setQuery('')
    } else {
      const selected = allOptions.find((opt) => opt.id === id)
      if (selected) setQuery(getDisplayLabel(selected))
    }
  }, [allOptions, getDisplayLabel, selectedId])

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
  }, [allOptions, getDisplayLabel, query])

  useEffect(() => {
    if (disabled) {
      setIsOpen(false)
      setDialogOpen(false)
    }
  }, [disabled])

  useEffect(() => {
    if (!isOpen || filteredOptions.length === 0) {
      setHighlightedIndex(-1)
      return
    }

    const selectedIndex = filteredOptions.findIndex((opt) => opt.id === value)
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0)
  }, [filteredOptions, isOpen, value])

  const defaultPlaceholder =
    placeholder || `Wpisz, aby filtrowac ${label.toLowerCase()}...`
  const canCreateInline = Boolean(createAction)
  const shouldShowQuickAdd = !disabled && canCreateInline && isOpen && query.trim() !== '' && filteredOptions.length === 0
  const resolvedEmptyOptionLabel = emptyOptionLabel ?? '— brak —'
  const closedDisplayValue = !isOpen && value === '' && query.trim() === ''
    ? resolvedEmptyOptionLabel
    : query
  const isEmptyClosedDisplay = !isOpen && value === ''

  return (
    <div className="flex flex-col gap-2">
      {!hideLabel && (
        <label className="text-sm font-medium text-neutral-300">
          {label}
          {required ? ' *' : ''}
        </label>
      )}
      <input type="hidden" name={name} value={value} disabled={disabled} />

      <div ref={wrapperRef} onBlur={handleWrapperBlur} className="flex flex-col gap-2">
        <div className="relative">
          <input
            type="text"
            value={isOpen ? query : closedDisplayValue}
            disabled={disabled}
            onChange={(e) => {
              if (disabled) return
              setQuery(e.target.value)
              setIsOpen(true)
            }}
            onFocus={() => {
              if (disabled) return
              setIsOpen(true)
            }}
            onKeyDown={(e) => {
              if (disabled) return

              if (e.key === 'Escape') {
                e.preventDefault()
                setIsOpen(false)
                const selected = allOptions.find((opt) => opt.id === value)
                setQuery(selected ? getDisplayLabel(selected) : '')
                return
              }

              if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') {
                return
              }

              if (!isOpen) {
                setIsOpen(true)
              }

              if (e.key === 'Enter') {
                if (filteredOptions.length === 0) {
                  // No matches: Enter opens create dialog if there's a search query
                  if (canCreateInline && query.trim() !== '') {
                    e.preventDefault()
                    setIsOpen(false)
                    setDialogOpen(true)
                  }
                  return
                }

                if (highlightedIndex < 0 || highlightedIndex >= filteredOptions.length) {
                  return
                }

                e.preventDefault()
                const option = filteredOptions[highlightedIndex]
                setValue(option.id)
                onSelectedIdChange?.(option.id)
                setQuery(getDisplayLabel(option))
                setIsOpen(false)
                return
              }

              if (filteredOptions.length === 0) {
                return
              }

              e.preventDefault()
              const isArrowDown = e.key === 'ArrowDown'
              const maxIndex = filteredOptions.length - 1

              let nextIndex = highlightedIndex
              if (nextIndex < 0) {
                nextIndex = isArrowDown ? 0 : maxIndex
              } else {
                nextIndex = isArrowDown
                  ? Math.min(nextIndex + 1, maxIndex)
                  : Math.max(nextIndex - 1, 0)
              }

              setHighlightedIndex(nextIndex)
              const option = filteredOptions[nextIndex]
              if (option) {
                setValue(option.id)
                onSelectedIdChange?.(option.id)
              }
            }}
            placeholder={defaultPlaceholder}
            className={`w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm ${isEmptyClosedDisplay ? 'text-neutral-500' : 'text-neutral-100'} placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 disabled:cursor-not-allowed disabled:opacity-60`}
          />

          {shouldShowQuickAdd && (
            <button
              type="button"
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setIsOpen(false)
                setDialogOpen(true)
              }}
              className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-700 text-sm font-bold text-white hover:bg-neutral-600"
              aria-label={addButtonLabel ?? 'Dodaj nową opcję'}
              title={addButtonLabel ?? 'Dodaj nową opcję'}
            >
              +
            </button>
          )}

          {isOpen && !disabled && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 shadow-xl">
              {filteredOptions.length > 0 ? (
                <>
                  {!required && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setValue('')
                        onSelectedIdChange?.('')
                        setQuery('')
                        setIsOpen(false)
                      }}
                      className={`w-full border-b border-neutral-800 px-3 py-1.5 text-left text-sm ${
                        value === '' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-300 hover:bg-neutral-800'
                      }`}
                    >
                      {resolvedEmptyOptionLabel}
                    </button>
                  )}
                  {filteredOptions.map((opt, index) => (
                    <button
                      key={opt.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onClick={() => {
                        setValue(opt.id)
                        onSelectedIdChange?.(opt.id)
                        setQuery(getDisplayLabel(opt))
                        setIsOpen(false)
                      }}
                      className={`w-full border-b border-neutral-800 px-3 py-1.5 text-left text-sm last:border-b-0 ${
                        index === highlightedIndex ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-200 hover:bg-neutral-800'
                      }`}
                    >
                      {getDisplayLabel(opt)}
                    </button>
                  ))}
                </>
              ) : query.trim() !== '' ? (
                <p className="px-3 py-1.5 text-xs text-neutral-500">
                  {emptyResultsMessage ?? 'Brak wyników.'}
                </p>
              ) : (
                <p className="px-3 py-1.5 text-xs text-neutral-500">Wpisz, aby wyszukać...</p>
              )}
            </div>
          )}
        </div>
      </div>

      {canCreateInline && dialogOpen && !disabled && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setDialogOpen(false)}
          />

          <div className="relative z-[71] w-full max-w-xl rounded-xl border border-neutral-700 bg-neutral-950 p-5 shadow-2xl">
            <p className="mb-3 text-sm font-semibold text-neutral-100">{addDialogTitle ?? 'Nowa opcja'}</p>

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
        </div>
      )}
    </div>
  )
}
