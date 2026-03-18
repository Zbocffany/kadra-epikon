'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'

type Option = {
  id: string
  label: string
}

type FederationOption = {
  id: string
  short_name: string
}

type InlineCreateState = {
  ok: boolean
  id?: string
  label?: string
  error?: string
  version: number
}

type CreateCountryInlineAction = (
  prevState: InlineCreateState,
  formData: FormData
) => Promise<InlineCreateState>

type CountrySelectFieldProps = {
  name: string
  label: string
  selectedId?: string | null
  required?: boolean
  options: Option[]
  federationOptions: FederationOption[]
  createCountryInlineAction: CreateCountryInlineAction
  placeholder?: string
}

export default function CountrySelectField({
  name,
  label,
  selectedId,
  required,
  options,
  federationOptions,
  createCountryInlineAction,
  placeholder = 'Wpisz, aby filtrowac kraje',
}: CountrySelectFieldProps) {
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
      const result = await createCountryInlineAction({ ok: false, version: 0 }, formData)
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
      <label className="text-sm font-medium text-neutral-300">
        {label}
        {required ? ' *' : ''}
      </label>
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
            {!required && <option value="">— brak —</option>}
            {required && <option value="">— wybierz —</option>}
            {filteredOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
        {isOpen && query.trim() !== '' && filteredOptions.length === 0 && (
          <p className="text-xs text-neutral-500 px-1">Brak wyników &mdash; możesz dodać nowy kraj poniżej.</p>
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
          + Dodaj kraj
        </button>
      </div>

      {dialogOpen && (
        <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-4">
          <p className="mb-3 text-sm font-semibold text-neutral-100">Nowy kraj</p>

          {createError && (
            <div className="mb-3 rounded-md border border-red-800 bg-red-950/50 px-3 py-2 text-xs text-red-300">
              {createError}
            </div>
          )}

          <div ref={inlineFormRef} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="inline_country_name" className="text-xs text-neutral-400">
                  Nazwa kraju
                </label>
                <input
                  id="inline_country_name"
                  name="name"
                  type="text"
                  required
                  className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="inline_country_fifa" className="text-xs text-neutral-400">
                  Kod FIFA
                </label>
                <input
                  id="inline_country_fifa"
                  name="fifa_code"
                  type="text"
                  maxLength={3}
                  className="uppercase rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="inline_country_federation" className="text-xs text-neutral-400">
                Federacja
              </label>
              <select
                id="inline_country_federation"
                name="federation_id"
                className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
              >
                <option value="">— brak —</option>
                {federationOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.short_name}
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
