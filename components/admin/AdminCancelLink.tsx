'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'

type AdminCancelLinkProps = {
  href: string
  className?: string
  children?: ReactNode
  confirmMessage?: string
}

const DEFAULT_CONFIRM_MESSAGE = 'Wprowadzone zmiany nie zostana zapisane. Czy chcesz anulowac?'

export default function AdminCancelLink({
  href,
  className,
  children,
  confirmMessage = DEFAULT_CONFIRM_MESSAGE,
}: AdminCancelLinkProps) {
  const router = useRouter()
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  return (
    <>
      <Link
        href={href}
        className={className}
        onClick={(event) => {
          event.preventDefault()
          setIsConfirmOpen(true)
        }}
      >
        {children ?? 'Anuluj'}
      </Link>

      {isConfirmOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="w-full max-w-md rounded-xl border border-neutral-700 bg-neutral-950 p-5 shadow-2xl">
            <p className="text-sm text-neutral-200">{confirmMessage}</p>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
              >
                Wroc
              </button>
              <button
                type="button"
                onClick={() => router.push(href)}
                className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white"
              >
                Odrzuc zmiany
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
