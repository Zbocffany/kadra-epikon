import type { SVGProps } from 'react'

export default function BenchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      {/* Seat plank */}
      <rect x="2" y="11" width="20" height="2.5" rx="1" fill="currentColor" />
      {/* Back support */}
      <rect x="2" y="5" width="20" height="2" rx="1" fill="currentColor" />
      {/* Back leg (vertical connector) */}
      <rect x="3.5" y="7" width="1.5" height="4" rx="0.5" fill="currentColor" />
      <rect x="19" y="7" width="1.5" height="4" rx="0.5" fill="currentColor" />
      {/* Front legs */}
      <rect x="3.5" y="13.5" width="1.5" height="5.5" rx="0.75" fill="currentColor" />
      <rect x="19" y="13.5" width="1.5" height="5.5" rx="0.75" fill="currentColor" />
    </svg>
  )
}
