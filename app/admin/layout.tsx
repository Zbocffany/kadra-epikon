import type { ReactNode } from 'react'
import Link from 'next/link'
import { requireAdminAccess } from '@/lib/auth/admin'
import { signOutAction } from '@/app/login/actions'
import AdminStatusBar from '@/components/admin/AdminStatusBar'
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
          <nav className="flex items-center gap-4 text-sm">
                  <span className="font-semibold text-neutral-200">Admin</span>
                  <Link href="/admin/matches" className="text-neutral-400 hover:text-white">
                    Mecze
                  </Link>
                  <Link href="/admin/clubs" className="text-neutral-400 hover:text-white">
                    Kluby
                  </Link>
                  <Link href="/admin/countries" className="text-neutral-400 hover:text-white">
                    Kraje
                  </Link>
                  <Link href="/admin/cities" className="text-neutral-400 hover:text-white">
                    Miasta
                  </Link>
                  <Link href="/admin/stadiums" className="text-neutral-400 hover:text-white">
                    Stadiony
                  </Link>
                  <Link href="/admin/people" className="text-neutral-400 hover:text-white">
                    Ludzie
                  </Link>
                  <span className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-xs text-neutral-400">
                    {access.role}
                  </span>
          </nav>

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
