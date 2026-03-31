import type { ReactNode } from 'react'
import Link from 'next/link'
import { requireAdminAccess } from '@/lib/auth/admin'
import { signOutAction } from '@/app/login/actions'
import AdminStatusBar from '@/components/admin/AdminStatusBar'
import AdminTopNav from '@/components/admin/AdminTopNav'
import ThemeToggle from '@/components/ThemeToggle'

export default async function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  const access = await requireAdminAccess(['ADMIN', 'EDITOR'])

  return (
    <>
      <header className="border-b border-neutral-800 bg-neutral-950/80 px-4 py-3 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <AdminTopNav role={access.role} />

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
              >
                Wyloguj
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="pb-24">{children}</div>
      <AdminStatusBar />
    </>
  )
}
