import { ReactNode } from 'react'

export interface AdminTableColumn<T extends Record<string, unknown> = Record<string, unknown>> {
  key: string
  label: string
  headerRender?: () => ReactNode
  render: (row: T, index: number) => ReactNode
  className?: string
}

interface AdminTableProps<T extends Record<string, unknown> = Record<string, unknown>> {
  data: T[]
  columns: AdminTableColumn<T>[]
  emptyMessage: string
  idField?: string
  showHeader?: boolean
}

/**
 * Generic admin table component for displaying lists of items.
 * Handles:
 * - Column headers from config
 * - Consistent row background styling
 * - Custom cell rendering via render functions
 * - Empty state fallback
 *
 * Usage:
 * ```tsx
 * <AdminTable
 *   data={countries}
 *   columns={[
 *     { key: 'index', label: '#', render: (_, i) => i + 1 },
 *     { key: 'name', label: 'Nazwa', render: (c) => c.name },
 *   ]}
 *   emptyMessage="No countries found"
 * />
 * ```
 */
export default function AdminTable<T extends Record<string, unknown>>({
  data,
  columns,
  emptyMessage,
  idField = 'id',
  showHeader = true,
}: AdminTableProps<T>) {
  if (!data.length) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-6 py-16 text-center text-neutral-500">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="overflow-visible rounded-xl border border-neutral-800">
      <table className="w-full border-collapse text-sm overflow-visible">
        <thead>
          {showHeader && (
          <tr className="border-b border-neutral-800 bg-neutral-900 text-left">
            {columns.map((col) => (
              <th key={col.key} className={`px-4 py-3 font-medium text-neutral-400`}>
                {col.headerRender ? col.headerRender() : col.label}
              </th>
            ))}
          </tr>
          )}
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={String(row[idField] ?? i)}
              className="border-b border-neutral-800 bg-neutral-950 last:border-b-0 transition-colors hover:bg-neutral-900/60"
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 ${col.className ?? ''}`}>
                  {col.render(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
