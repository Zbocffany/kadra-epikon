'use client'

import { usePathname } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'
import SmartPrefetchLink from '@/components/navigation/SmartPrefetchLink'

const menu = [
  { href: '/', label: 'Home' },
  { href: '/matches', label: 'Mecze' },
  { href: '/players', label: 'Piłkarze' },
  { href: '/coaches', label: 'Trenerzy' },
  { href: '/referees', label: 'Sędziowie' },
  { href: '/countries', label: 'Kraje' },
  { href: '/clubs', label: 'Kluby' },
]

function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function PublicTopMenu() {
  const pathname = usePathname()
  const menuWidthClass = 'max-w-[74rem]'

  if (pathname.startsWith('/admin') || pathname.startsWith('/login')) {
    return null
  }

  return (
    <header className="border-b border-emerald-900/70 bg-[linear-gradient(165deg,#1f9f4a_0%,#0e8a3a_20%,#0a6f31_55%,#0a5a2a_100%)] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-2px_10px_rgba(0,0,0,0.25)] backdrop-blur sm:px-8">
      <div className={`mx-auto flex ${menuWidthClass} flex-wrap items-center justify-between gap-3`}>
        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex flex-wrap items-center gap-2">
            {menu.map(({ href, label }) => {
              const isActive = isActivePath(pathname, href)

              return (
                <SmartPrefetchLink
                  key={href}
                  href={href}
                  prefetchOnMount
                  className={`relative inline-flex items-center overflow-hidden rounded-md border px-[10px] py-[5px] text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_1px_rgba(0,0,0,0.45),0_1px_2px_rgba(0,0,0,0.45),0_4px_8px_rgba(0,0,0,0.24)] transition ${isActive ? 'border-emerald-200/70 bg-emerald-900/70 text-emerald-50 shadow-[0_0_14px_rgba(52,211,153,0.32)]' : 'border-emerald-900/70 bg-emerald-950/55 text-emerald-100 hover:border-emerald-300/45 hover:text-emerald-50'}`}
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.28)_0%,rgba(255,255,255,0.1)_34%,rgba(255,255,255,0)_62%),linear-gradient(130deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0)_50%)]"
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
            className="rounded-md border border-emerald-900/70 bg-emerald-950/55 px-3 py-1.5 text-xs font-semibold text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] hover:border-emerald-300/45 hover:text-emerald-50"
          >
            Zaloguj
          </SmartPrefetchLink>
        </div>
      </div>
    </header>
  )
}
