'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export default function SortableStatHeader({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  label: string
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null)

  function updateTooltipPosition() {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    setTooltipPosition({
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    })
  }

  useEffect(() => {
    if (!isVisible) return

    updateTooltipPosition()

    const handleWindowChange = () => updateTooltipPosition()

    window.addEventListener('scroll', handleWindowChange, true)
    window.addEventListener('resize', handleWindowChange)

    return () => {
      window.removeEventListener('scroll', handleWindowChange, true)
      window.removeEventListener('resize', handleWindowChange)
    }
  }, [isVisible])

  return (
    <div ref={containerRef} className="relative z-10 flex justify-center">
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => {
          updateTooltipPosition()
          setIsVisible(true)
        }}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => {
          updateTooltipPosition()
          setIsVisible(true)
        }}
        onBlur={() => setIsVisible(false)}
        className={`relative mx-auto flex items-center justify-center gap-0.5 transition-opacity ${
          active ? 'opacity-100' : 'opacity-50 hover:opacity-80'
        }`}
        aria-label={label}
        title={label}
      >
        {icon}
        <span className={`text-[10px] leading-none ${
          active ? 'text-neutral-300' : 'invisible'
        }`}>▼</span>
      </button>

      {isVisible && tooltipPosition
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[9999] whitespace-nowrap rounded-md border border-neutral-500 bg-black px-2 py-1 text-[11px] font-bold text-white shadow-lg"
              style={{
                top: tooltipPosition.top,
                left: tooltipPosition.left,
                transform: 'translate(-50%, -100%)',
              }}
            >
              {label}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
