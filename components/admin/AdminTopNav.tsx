'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type AdminTopNavProps = {
  role: string
}

const NAV_ITEMS = [
  { href: '/admin/matches', label: 'Mecze' },
  { href: '/admin/clubs', label: 'Kluby' },
  { href: '/admin/countries', label: 'Kraje' },
  { href: '/admin/cities', label: 'Miasta' },
  { href: '/admin/stadiums', label: 'Stadiony' },
  { href: '/admin/people', label: 'Ludzie' },
] as const

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function AdminTopNav({ role }: AdminTopNavProps) {
  const pathname = usePathname() ?? ''

  return (
    <nav className="flex items-center gap-1.5 text-sm">
      {NAV_ITEMS.map((item) => {
        const isActive = isActivePath(pathname, item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              isActive
                ? 'rounded-md border border-neutral-600 bg-neutral-900 px-2.5 py-1 font-semibold text-white'
                : 'rounded-md px-2.5 py-1 text-neutral-400 hover:text-white'
            }
          >
            {item.label}
          </Link>
        )
      })}

      <ViewModeToggle currentMode="ADMIN" role={role} />
    </nav>
  )
}

/**
 * Przełącznik trybu widoku ADMIN ↔ PUBLIC. Aktywny tryb wygląda jak dawny
 * badge `[ADMIN]`; tryb nieaktywny to link. Renderowany w obu belkach —
 * admina i publicznej (dla zalogowanych) — żeby jednym kliknięciem
 * przechodzić między panelem edycji a widokiem publicznym.
 */
export function ViewModeToggle({
  currentMode,
  role,
}: {
  currentMode: 'ADMIN' | 'PUBLIC'
  role: string
}) {
  const activeClass =
    'rounded-md border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-xs font-semibold text-neutral-200'
  const inactiveClass =
    'rounded-md border border-neutral-700 bg-neutral-900/40 px-2 py-0.5 text-xs font-semibold text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'

  return (
    <span className="ml-1 inline-flex items-center gap-1">
      {currentMode === 'ADMIN' ? (
        <span className={activeClass} title={`Zalogowany jako ${role}`}>
          ADMIN
        </span>
      ) : (
        <Link href="/admin/matches" className={inactiveClass} title="Przejdź do panelu admina">
          ADMIN
        </Link>
      )}
      {currentMode === 'PUBLIC' ? (
        <span className={activeClass}>PUBLIC</span>
      ) : (
        <Link href="/" className={inactiveClass} title="Przejdź do widoku publicznego">
          PUBLIC
        </Link>
      )}
    </span>
  )
}
