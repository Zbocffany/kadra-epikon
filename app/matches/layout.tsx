import type { ReactNode } from 'react'

export default function PublicMatchesLayout({ children }: { children: ReactNode }) {
  return <div className="pb-24">{children}</div>
}