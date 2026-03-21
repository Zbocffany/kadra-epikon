'use client'

import { useEffect } from 'react'

export function useUnsavedChanges(isDirty: boolean, shouldBypass?: () => boolean) {
  useEffect(() => {
    if (!isDirty) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (shouldBypass?.()) {
        return
      }

      e.preventDefault()
      e.returnValue = ''
      return ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty, shouldBypass])
}
