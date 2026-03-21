'use client'

import { useState, ReactNode, useEffect, useRef } from 'react'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import UnsavedChangesDialog from '@/components/admin/UnsavedChangesDialog'

type EditMatchFormWrapperProps = {
  children: ReactNode
  onFormChange?: () => void
}

export default function EditMatchFormWrapper({ children, onFormChange }: EditMatchFormWrapperProps) {
  const [isDirty, setIsDirty] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const bypassBeforeUnloadRef = useRef(false)

  // Handle beforeunload (browser back button, refresh, closing tab)
  useUnsavedChanges(isDirty, () => bypassBeforeUnloadRef.current)

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

      // Show dialog instead of confirm
      e.preventDefault()
      e.stopPropagation()
      setPendingHref(link.href)
      setShowDialog(true)
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [isDirty])

  const handleDialogConfirm = () => {
    if (pendingHref) {
      // User confirmed leaving via UI dialog, so skip browser beforeunload warning.
      bypassBeforeUnloadRef.current = true
      window.location.assign(pendingHref)
    }
    setShowDialog(false)
    setPendingHref(null)
  }

  const handleDialogCancel = () => {
    bypassBeforeUnloadRef.current = false
    setShowDialog(false)
    setPendingHref(null)
  }

  return (
    <>
      <div ref={containerRef}>
        {children}
      </div>
      <UnsavedChangesDialog
        isOpen={showDialog}
        onConfirm={handleDialogConfirm}
        onCancel={handleDialogCancel}
      />
    </>
  )
}
