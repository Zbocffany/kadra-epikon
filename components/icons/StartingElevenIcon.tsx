import type { SVGProps } from 'react'

export default function StartingElevenIcon(props: SVGProps<SVGSVGElement>) {
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
      <rect x="4.7" y="7.3" width="14.6" height="9.4" rx="1.4" fill="rgba(0,0,0,0.38)" stroke="white" strokeWidth="0.6" />
      <text
        x="12"
        y="14.1"
        textAnchor="middle"
        fill="white"
        fontSize="5.6"
        fontWeight="700"
        fontFamily="Barlow Condensed, sans-serif"
      >
        11
      </text>
    </svg>
  )
}
