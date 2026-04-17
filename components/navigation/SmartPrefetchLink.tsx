'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import type { ComponentProps } from 'react'

type SmartPrefetchLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string
  prefetchOnMount?: boolean
  preferHistoryBack?: boolean
}

export default function SmartPrefetchLink({
  href,
  prefetchOnMount = false,
  preferHistoryBack = false,
  onMouseEnter,
  onFocus,
  onTouchStart,
  onClick,
  prefetch,
  ...props
}: SmartPrefetchLinkProps) {
  const router = useRouter()

  const prefetchHref = () => {
    router.prefetch(href)
  }

  useEffect(() => {
    if (prefetchOnMount) {
      prefetchHref()
    }
  }, [prefetchOnMount, href, router])

  return (
    <Link
      {...props}
      href={href}
      prefetch={prefetch ?? true}
      onMouseEnter={(event) => {
        prefetchHref()
        onMouseEnter?.(event)
      }}
      onFocus={(event) => {
        prefetchHref()
        onFocus?.(event)
      }}
      onTouchStart={(event) => {
        prefetchHref()
        onTouchStart?.(event)
      }}
      onClick={(event) => {
        onClick?.(event)

        if (!preferHistoryBack || event.defaultPrevented || typeof window === 'undefined') {
          return
        }

        const hasHistory = window.history.length > 1
        const hasInternalReferrer = !!document.referrer && new URL(document.referrer).origin === window.location.origin

        if (hasHistory && hasInternalReferrer) {
          event.preventDefault()
          window.history.back()
        }
      }}
    />
  )
}
