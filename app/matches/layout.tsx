import Link from 'next/link'
import type { ReactNode } from 'react'
import ThemeToggle from '@/components/ThemeToggle'

export default function PublicMatchesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-neutral-800 bg-neutral-950/80 px-4 py-3 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link
            href="/"
            className="text-sm font-semibold uppercase tracking-[0.22em] text-neutral-200 transition hover:text-white"
          >
            Kadra Epikon
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/login"
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
            >
              Zaloguj
            </Link>
          </div>
        </div>
      </header>

      <div className="pb-24">{children}</div>
    </>
  )
}