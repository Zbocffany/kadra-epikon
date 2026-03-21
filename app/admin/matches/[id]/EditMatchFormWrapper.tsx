'use client'

import { useState, ReactNode, useEffect, useRef } from 'react'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'

type EditMatchFormWrapperProps = {
  children: ReactNode
  onFormChange?: () => void
}

export default function EditMatchFormWrapper({ children, onFormChange }: EditMatchFormWrapperProps) {
  const [isDirty, setIsDirty] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle beforeunload (browser back button, refresh, closing tab)
  useUnsavedChanges(isDirty)

  // Listen for form changes
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleChange = () => {
      if (!isDirty) {
        setIsDirty(true)
      }
      onFormChange?.()
    }

    // Use capture phase for input/change events
    container.addEventListener('input', handleChange, true)
    container.addEventListener('change', handleChange, true)

    return () => {
      container.removeEventListener('input', handleChange, true)
      container.removeEventListener('change', handleChange, true)
    }
  }, [isDirty, onFormChange])

  // Intercept Next.js link navigation
  useEffect(() => {
    if (!isDirty) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a[href]') as HTMLAnchorElement | null

      // Skip if it's an internal link without valid href
      if (!link || !link.href) return

      // Skip external links or file downloads
      if (link.target === '_blank' || link.href.startsWith('mailto:') || link.href.startsWith('tel:')) {
        return
      }

      // Ask for confirmation
      if (!window.confirm('Masz niezapisane zmiany. Czy na pewno chcesz opuścić tę stronę bez zapisania?')) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [isDirty])

  return (
    <div ref={containerRef}>
      {children}
    </div>
  )
}
