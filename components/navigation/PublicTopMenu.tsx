'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'
import SmartPrefetchLink from '@/components/navigation/SmartPrefetchLink'

const menu = [
  { href: '/', label: 'Home' },
  { href: '/matches', label: 'Mecze' },
  { href: '/people', label: 'Osoby' },
  { href: '/clubs', label: 'Kluby' },
]

function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function PublicTopMenu() {
  const pathname = usePathname()

  if (pathname.startsWith('/admin') || pathname.startsWith('/login')) {
    return null
  }

  return (
    <header className="border-b border-neutral-800 bg-neutral-950/80 px-4 py-3 backdrop-blur sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SmartPrefetchLink
            href="/"
            prefetchOnMount
            className="mr-2 text-sm font-semibold uppercase tracking-[0.22em] text-neutral-200 transition hover:text-white"
          >
            Kadra Epikon
          </SmartPrefetchLink>

          <nav className="flex flex-wrap items-center gap-2">
            {menu.map(({ href, label }) => {
              const isActive = isActivePath(pathname, href)

              return (
                <SmartPrefetchLink
                  key={href}
                  href={href}
                  prefetchOnMount
                  className={`relative inline-flex items-center overflow-hidden rounded-md border px-[10px] py-[5px] text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_1px_rgba(0,0,0,0.55),0_1px_2px_rgba(0,0,0,0.65),0_4px_8px_rgba(0,0,0,0.35)] transition ${isActive ? 'border-red-500 bg-red-950 text-red-100 shadow-[0_0_16px_rgba(239,68,68,0.4)]' : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-500 hover:text-white'}`}
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0.12)_32%,rgba(255,255,255,0)_60%),linear-gradient(130deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0)_50%)]"
                  />
                  <span className="relative z-10">{label}</span>
                </SmartPrefetchLink>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SmartPrefetchLink
            href="/login"
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
          >
            Zaloguj
          </SmartPrefetchLink>
        </div>
      </div>
    </header>
  )
}
