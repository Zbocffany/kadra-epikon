import type { SVGProps } from 'react'

export default function SubOffPitchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <rect x="1.5" y="2.5" width="21" height="19" rx="1" fill="#16a34a" />
      <rect x="2.5" y="3.5" width="19" height="17" fill="none" stroke="white" strokeWidth="0.8" />
      <line x1="12" y1="3.5" x2="12" y2="20.5" stroke="white" strokeWidth="0.8" />
      <path
        d="M16 8.5L11.2 13.3H13.9V15h-5.8V9.2h1.7v2.7l5-5 1.2 1.6Z"
        fill="#EF4444"
        stroke="#7F1D1D"
        strokeWidth="0.35"
      />
    </svg>
  )
}
