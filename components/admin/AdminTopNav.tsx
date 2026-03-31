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

      <span className="ml-1 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-xs text-neutral-400">
        {role}
      </span>
    </nav>
  )
}
