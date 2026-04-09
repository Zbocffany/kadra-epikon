import type { SVGProps } from 'react'

export default function PitchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      {/* Pitch background */}
      <rect x="1.5" y="2.5" width="21" height="19" rx="1" fill="#16a34a" />
      {/* Outer border */}
      <rect x="2.5" y="3.5" width="19" height="17" fill="none" stroke="white" strokeWidth="0.8" />
      {/* Center vertical line */}
      <line x1="12" y1="3.5" x2="12" y2="20.5" stroke="white" strokeWidth="0.8" />
      {/* Center circle */}
      <circle cx="12" cy="12" r="3.5" fill="none" stroke="white" strokeWidth="0.8" />
      {/* Center dot */}
      <circle cx="12" cy="12" r="0.6" fill="white" />
      {/* Left penalty area */}
      <rect x="2.5" y="7.5" width="4.5" height="9" fill="none" stroke="white" strokeWidth="0.7" />
      {/* Right penalty area */}
      <rect x="17" y="7.5" width="4.5" height="9" fill="none" stroke="white" strokeWidth="0.7" />
      {/* Left goal */}
      <rect x="2.5" y="9.8" width="1.5" height="4.4" fill="none" stroke="white" strokeWidth="0.7" />
      {/* Right goal */}
      <rect x="20" y="9.8" width="1.5" height="4.4" fill="none" stroke="white" strokeWidth="0.7" />
    </svg>
  )
}
