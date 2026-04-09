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
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-0.5 mx-auto transition-opacity ${
        active ? 'opacity-100' : 'opacity-50 hover:opacity-80'
      }`}
      title={label}
    >
      {icon}
      <span className={`text-[10px] leading-none ${
        active ? 'text-neutral-300' : 'text-neutral-500'
      }`}>{active ? '▼' : ''}</span>
    </button>
  )
}
