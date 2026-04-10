import type { ReactNode } from 'react'

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
  return (
    <div className="group/stat relative flex justify-center">
      <button
        type="button"
        onClick={onClick}
        className={`flex items-center justify-center gap-0.5 mx-auto transition-opacity ${
          active ? 'opacity-100' : 'opacity-50 hover:opacity-80'
        }`}
      >
        {icon}
        <span className={`text-[10px] leading-none ${
          active ? 'text-neutral-300' : 'invisible'
        }`}>▼</span>
      </button>
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-neutral-500 bg-black px-2 py-1 text-[11px] font-bold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/stat:opacity-100">
        {label}
      </div>
    </div>
  )
}
