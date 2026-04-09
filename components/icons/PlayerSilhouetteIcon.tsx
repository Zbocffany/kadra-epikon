import type { SVGProps } from 'react'

export default function PlayerSilhouetteIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      {/* Head */}
      <circle cx="12" cy="7" r="4" />
      {/* Body / shoulders */}
      <path d="M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8H4Z" />
    </svg>
  )
}
