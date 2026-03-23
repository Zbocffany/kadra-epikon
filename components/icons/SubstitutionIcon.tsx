import type { SVGProps } from 'react'

export default function SubstitutionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      {/* Top arrow: right direction, green */}
      <path
        d="M4 8H16"
        stroke="#22C55E"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M13.6 5.7L16.3 8L13.6 10.3"
        stroke="#22C55E"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Bottom arrow: left direction, yellow */}
      <path
        d="M20 16H8"
        stroke="#DC2626"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M10.4 13.7L7.7 16L10.4 18.3"
        stroke="#DC2626"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
