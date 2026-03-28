'use client'

import { useEffect, useState } from 'react'

type ThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'kadra-theme'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>('dark')

  useEffect(() => {
    const root = document.documentElement
    const isLight = root.classList.contains('theme-light')
    setTheme(isLight ? 'light' : 'dark')
  }, [])

  function applyTheme(nextTheme: ThemeMode) {
    const root = document.documentElement
    root.classList.remove('theme-light', 'theme-dark')
    root.classList.add(nextTheme === 'light' ? 'theme-light' : 'theme-dark')
    localStorage.setItem(STORAGE_KEY, nextTheme)
    setTheme(nextTheme)
  }

  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={() => applyTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Przelacz na tryb jasny' : 'Przelacz na tryb ciemny'}
      title={isDark ? 'Tryb jasny' : 'Tryb ciemny'}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-700 bg-neutral-900 text-sm text-neutral-200 hover:bg-neutral-800"
    >
      <span aria-hidden="true">{isDark ? '☀' : '☾'}</span>
    </button>
  )
}
