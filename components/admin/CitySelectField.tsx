'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { InlineCreateState, SelectOption } from '@/lib/types/admin'

type Option = SelectOption

type CountryOption = {
  id: string
  name: string
}

type CreateCityInlineAction = (
  prevState: InlineCreateState,
  formData: FormData
) => Promise<InlineCreateState>

type CitySelectFieldProps = {
  name: string
  label: string
  selectedId?: string | null
  options: Option[]
  countryOptions: CountryOption[]
  createCityInlineAction: CreateCityInlineAction
  placeholder?: string
}

export default function CitySelectField({
  name,
  label,
  selectedId,
  options,
  countryOptions,
  createCityInlineAction,
  placeholder = 'Wpisz, aby filtrowac miasta',
}: CitySelectFieldProps) {
  const [allOptions, setAllOptions] = useState<Option[]>(options)
  const [query, setQuery] = useState('')
  const [value, setValue] = useState(selectedId ?? '')
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

  function handleInlineCreate() {
    if (!inlineFormRef.current || isPending) return
    const elems = inlineFormRef.current.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[name], select[name]')
    for (const el of elems) {
      if (!el.checkValidity()) { el.reportValidity(); return }
    }
    const formData = new FormData()
    elems.forEach((el) => formData.append(el.name, el.value))
    setCreateError(undefined)
    startTransition(async () => {
      const result = await createCityInlineAction({ ok: false, version: 0 }, formData)
      if (result.ok && result.id && result.label) {
        const newId = result.id
        const newLabel = result.label
        setAllOptions((prev) => {
          if (prev.some((opt) => opt.id === newId)) return prev
          const next = [...prev, { id: newId, label: newLabel }]
          next.sort((a, b) => a.label.localeCompare(b.label, 'pl'))
          return next
        })
        setValue(newId)
        setQuery(newLabel)
        setDialogOpen(false)
      } else {
        setCreateError(result.error)
      }
    })
  }

  useEffect(() => { setAllOptions(options) }, [options])
  useEffect(() => { setValue(selectedId ?? '') }, [selectedId])

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allOptions
    const matches = allOptions.filter((opt) => opt.label.toLowerCase().includes(q))
    matches.sort((a, b) => {
      const aStarts = a.label.toLowerCase().startsWith(q)
      const bStarts = b.label.toLowerCase().startsWith(q)
      if (aStarts && !bStarts) return -1
      if (!aStarts && bStarts) return 1
      return a.label.localeCompare(b.label, 'pl')
    })
    return matches
  }, [allOptions, query])

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-neutral-300">{label}</label>
      <input type="hidden" name={name} value={value} />

      <div ref={wrapperRef} onBlur={handleWrapperBlur} className="flex flex-col gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true) }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
        />

        {isOpen && filteredOptions.length > 0 && (
          <select
            value={value}
            onChange={(e) => {
              const id = e.target.value
              setValue(id)
              const selected = allOptions.find((opt) => opt.id === id)
              if (selected) setQuery(selected.label)
              setIsOpen(false)
            }}
            size={Math.min(6, Math.max(3, filteredOptions.length))}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
          >
            <option value="">— brak —</option>
            {filteredOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
        {isOpen && query.trim() !== '' && filteredOptions.length === 0 && (
          <p className="text-xs text-neutral-500 px-1">Brak wyników &mdash; możesz dodać nowe miasto poniżej.</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-neutral-500">Wybrane: {allOptions.find((o) => o.id === value)?.label ?? '—'}</p>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setIsOpen(false)
            setDialogOpen(true)
          }}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
        >
          + Dodaj miasto
        </button>
      </div>

      {dialogOpen && (
        <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-4">
          <p className="mb-3 text-sm font-semibold text-neutral-100">Nowe miasto</p>

          {createError && (
            <div className="mb-3 rounded-md border border-red-800 bg-red-950/50 px-3 py-2 text-xs text-red-300">
              {createError}
            </div>
          )}

          <div ref={inlineFormRef} className="space-y-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="inline_city_name" className="text-xs text-neutral-400">
                Nazwa miasta
              </label>
              <input
                id="inline_city_name"
                name="city_name"
                type="text"
                required
                className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="inline_city_country" className="text-xs text-neutral-400">
                Kraj
              </label>
              <select
                id="inline_city_country"
                name="country_id"
                required
                className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
              >
                <option value="">— wybierz —</option>
                {countryOptions.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2">
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
