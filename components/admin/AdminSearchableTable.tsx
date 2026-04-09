'use client'

import { useMemo, useState } from 'react'
import AdminTable from '@/components/admin/AdminTable'
import type { AdminTableColumn } from '@/components/admin/AdminTable'

type FilterConfig<T> = {
  label: string
  allLabel: string
  getValue: (row: T) => string | string[] | null | undefined
}

type AdminSearchableTableProps<T extends Record<string, unknown>> = {
  data: T[]
  columns: AdminTableColumn<T>[]
  searchLabel?: string
  searchPlaceholder: string
  priorityHint?: string
  emptyMessage: string
  emptySearchMessage: string
  getPrimaryText: (row: T) => string | null | undefined
  getSecondaryTexts?: (row: T) => Array<string | null | undefined>
  filterConfig?: FilterConfig<T>
  secondaryFilterConfig?: FilterConfig<T>
  tertiaryFilterConfig?: FilterConfig<T>
  summaryText?: (visible: number, total: number) => string
  filterWidthClass?: string
  secondaryFilterWidthClass?: string
  tertiaryFilterWidthClass?: string
  showHeader?: boolean
  defaultLimit?: number
  defaultFilter?: string
  defaultTertiaryFilter?: string
  searchIgnoresFilters?: boolean
}

function normalizeFilterValue(value: string | string[] | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry) => Boolean(entry))
  }

  return value ? [value] : []
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

function getRank(
  primaryText: string | null | undefined,
  secondaryTexts: Array<string | null | undefined>,
  query: string
) {
  const primary = normalizeText(primaryText)
  if (!primary) return -1

  if (primary.startsWith(query)) {
    return 0
  }

  if (primary.split(/\s+/).some((part) => part.startsWith(query))) {
    return 1
  }

  if (primary.includes(query)) {
    return 2
  }

  const hasSecondaryMatch = secondaryTexts.some((text) => normalizeText(text).includes(query))
  return hasSecondaryMatch ? 3 : -1
}

export default function AdminSearchableTable<T extends Record<string, unknown>>({
  data,
  columns,
  searchLabel,
  searchPlaceholder,
  priorityHint,
  emptyMessage,
  emptySearchMessage,
  getPrimaryText,
  getSecondaryTexts,
  filterConfig,
  secondaryFilterConfig,
  tertiaryFilterConfig,
  summaryText,
  filterWidthClass = 'md:w-60',
  secondaryFilterWidthClass = 'md:w-60',
  tertiaryFilterWidthClass = 'md:w-60',
  showHeader = true,
  defaultLimit,
  defaultFilter,
  defaultTertiaryFilter,
  searchIgnoresFilters,
}: AdminSearchableTableProps<T>) {
  const [query, setQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState(defaultFilter ?? '')
  const [selectedSecondaryFilter, setSelectedSecondaryFilter] = useState('')
  const [selectedTertiaryFilter, setSelectedTertiaryFilter] = useState(defaultTertiaryFilter ?? '')

  const filterOptions = useMemo(() => {
    if (!filterConfig) return []

    return [...new Set(data.flatMap((row) => normalizeFilterValue(filterConfig.getValue(row))))]
      .sort((a, b) => String(a).localeCompare(String(b), 'pl')) as string[]
  }, [data, filterConfig])

  const secondaryFilterOptions = useMemo(() => {
    if (!secondaryFilterConfig) return []

    return [...new Set(data.flatMap((row) => normalizeFilterValue(secondaryFilterConfig.getValue(row))))]
      .sort((a, b) => String(a).localeCompare(String(b), 'pl')) as string[]
  }, [data, secondaryFilterConfig])

  const tertiaryFilterOptions = useMemo(() => {
    if (!tertiaryFilterConfig) return []

    return [...new Set(data.flatMap((row) => normalizeFilterValue(tertiaryFilterConfig.getValue(row))))]
      .sort((a, b) => String(a).localeCompare(String(b), 'pl')) as string[]
  }, [data, tertiaryFilterConfig])

  const filteredData = useMemo(() => {
    const normalizedQuery = normalizeText(query)

    // When searchIgnoresFilters is set and a query is active, search all data bypassing filters
    const baseByAllFilters = searchIgnoresFilters && normalizedQuery ? data : (() => {
      const baseByPrimaryFilter = filterConfig && selectedFilter
        ? data.filter((row) => normalizeFilterValue(filterConfig.getValue(row)).includes(selectedFilter))
        : data

      const base = secondaryFilterConfig && selectedSecondaryFilter
        ? baseByPrimaryFilter.filter((row) =>
          normalizeFilterValue(secondaryFilterConfig.getValue(row)).includes(selectedSecondaryFilter)
        )
        : baseByPrimaryFilter

      return tertiaryFilterConfig && selectedTertiaryFilter
        ? base.filter((row) =>
          normalizeFilterValue(tertiaryFilterConfig.getValue(row)).includes(selectedTertiaryFilter)
        )
        : base
    })()

    if (!normalizedQuery) {
      return baseByAllFilters
    }

    return [...baseByAllFilters]
      .map((row) => ({
        row,
        rank: getRank(
          getPrimaryText(row),
          getSecondaryTexts ? getSecondaryTexts(row) : [],
          normalizedQuery
        ),
      }))
      .filter((entry) => entry.rank >= 0)
      .sort((left, right) => {
        if (left.rank !== right.rank) {
          return left.rank - right.rank
        }

        const leftPrimary = String(getPrimaryText(left.row) ?? '')
        const rightPrimary = String(getPrimaryText(right.row) ?? '')
        return leftPrimary.localeCompare(rightPrimary, 'pl')
      })
      .map((entry) => entry.row)
  }, [
    data,
    filterConfig,
    secondaryFilterConfig,
    getPrimaryText,
    getSecondaryTexts,
    query,
    selectedFilter,
    selectedSecondaryFilter,
    selectedTertiaryFilter,
    searchIgnoresFilters,
  ])

  const isFiltered = query.trim() || selectedFilter || selectedSecondaryFilter || selectedTertiaryFilter
  const displayedData = defaultLimit && !isFiltered ? filteredData.slice(0, defaultLimit) : filteredData

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex-1">
            <div className="flex flex-col gap-1.5">
              {searchLabel && (
                <label htmlFor="admin-search" className="text-sm font-medium text-neutral-300">
                  {searchLabel}
                </label>
              )}
              <input
                id="admin-search"
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
              />
            </div>
          </div>

          {filterConfig && (
            <div className={filterWidthClass}>
              <div className="flex flex-col gap-1.5">
                {filterConfig.label && (
                  <label htmlFor="admin-filter" className="text-sm font-medium text-neutral-300">
                    {filterConfig.label}
                  </label>
                )}
                <select
                  id="admin-filter"
                  value={selectedFilter}
                  onChange={(event) => setSelectedFilter(event.target.value)}
                  className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                >
                  <option value="">{filterConfig.allLabel}</option>
                  {filterOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {secondaryFilterConfig && (
            <div className={secondaryFilterWidthClass}>
              <div className="flex flex-col gap-1.5">
                {secondaryFilterConfig.label && (
                  <label htmlFor="admin-secondary-filter" className="text-sm font-medium text-neutral-300">
                    {secondaryFilterConfig.label}
                  </label>
                )}
                <select
                  id="admin-secondary-filter"
                  value={selectedSecondaryFilter}
                  onChange={(event) => setSelectedSecondaryFilter(event.target.value)}
                  className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                >
                  <option value="">{secondaryFilterConfig.allLabel}</option>
                  {secondaryFilterOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {tertiaryFilterConfig && (
            <div className={tertiaryFilterWidthClass}>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="admin-tertiary-filter" className="text-sm font-medium text-neutral-300">
                  {tertiaryFilterConfig.label}
                </label>
                <select
                  id="admin-tertiary-filter"
                  value={selectedTertiaryFilter}
                  onChange={(event) => setSelectedTertiaryFilter(event.target.value)}
                  className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                >
                  <option value="">{tertiaryFilterConfig.allLabel}</option>
                  {tertiaryFilterOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {priorityHint && <p className="mt-3 text-xs text-neutral-500">{priorityHint}</p>}
      </div>

      <AdminTable
        data={displayedData}
        columns={columns}
        emptyMessage={query.trim() ? emptySearchMessage : emptyMessage}
        showHeader={showHeader}
      />

      {summaryText && filteredData.length > 0 && (
        <p className="text-xs text-neutral-500">{summaryText(displayedData.length, data.length)}</p>
      )}
    </div>
  )
}