import { ReactNode } from 'react'

interface AdminListLayoutProps {
  breadcrumb: string
  title: string
  recordCount: number
  recordLabel: string // singular (e.g., "kraj") or plural (e.g., "krajów")
  fetchError?: string | null
  children: ReactNode // Slot for add form + table (laid out vertically)
}

/**
 * Generic wrapper for admin list pages.
 * Provides:
 * - Page header (breadcrumb + title + record count badge)
 * - Fetch error banner
 * - Vertical layout for form and table (children)
 *
 * Usage:
 * ```tsx
 * <AdminListLayout
 *   title="Kraje"
 *   breadcrumb="Admin"
 *   recordCount={teams.length}
 *   recordLabel={teams.length === 1 ? 'kraj' : 'krajów'}
 *   fetchError={fetchError}
 * >
 *   <MyAddForm />
 *   <MyTable />
 * </AdminListLayout>
 * ```
 */
export default function AdminListLayout({
  breadcrumb,
  title,
  recordCount,
  recordLabel,
  fetchError,
  children,
}: AdminListLayoutProps) {
  return (
    <main className="min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              {breadcrumb}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{title}</h1>
          </div>
          <span className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs text-neutral-400">
            {recordCount} {recordLabel}
          </span>
        </div>

        {/* Fetch Error */}
        {fetchError && (
          <div className="mb-6 rounded-lg border border-red-800 bg-red-950/50 px-5 py-4 text-sm text-red-300">
            <strong className="font-semibold">Blad pobierania danych:</strong> {fetchError}
          </div>
        )}

        {/* Form + Table */}
        {!fetchError && <div className="space-y-6">{children}</div>}
      </div>
    </main>
  )
}
