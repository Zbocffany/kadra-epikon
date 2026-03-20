import type { ReactNode } from 'react'

type DetailsFieldCardProps = {
  label: string
  children: ReactNode
  spanTwo?: boolean
  spanThree?: boolean
}

export function DetailsFieldCard({
  label,
  children,
  spanTwo = false,
  spanThree = false,
}: DetailsFieldCardProps) {
  const spanClass = spanThree ? 'sm:col-span-3' : spanTwo ? 'sm:col-span-2' : ''

  return (
    <div className={`rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 ${spanClass}`}>
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  )
}

export function DetailsFieldValue({ value }: { value: string }) {
  return <p className="text-lg font-semibold text-neutral-100">{value}</p>
}