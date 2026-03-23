'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

export default function ValidationIssuesModal({
  errors,
  exitHref,
}: {
  errors: string[]
  exitHref: string
}) {
  const [isOpen, setIsOpen] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (!isOpen || errors.length === 0) {
    return null
  }

  function handleAcknowledge() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('error')

    const nextUrl = params.toString().length > 0
      ? `${pathname}?${params.toString()}`
      : pathname

    setIsOpen(false)
    router.replace(nextUrl)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-2xl rounded-xl border border-neutral-700 bg-neutral-950 p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-neutral-100">
          Przed zapisem popraw następujące nieścisłości:
        </h3>

        <ul className="mt-4 max-h-[45vh] list-disc space-y-1 overflow-y-auto pl-5 text-sm text-red-300">
          {errors.map((item, index) => (
            <li key={`validation-popup-error-${index}`}>{item}</li>
          ))}
        </ul>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleAcknowledge}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
          >
            Ok, rozumiem
          </button>
          <Link
            href={exitHref}
            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
          >
            Chcę wyjść mimo to
          </Link>
        </div>
      </div>
    </div>
  )
}
