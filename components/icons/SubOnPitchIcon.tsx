import type { SVGProps } from 'react'

export default function SubOnPitchIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M12 16.8V9.4" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 7.4L9.1 10.3H14.9L12 7.4Z" fill="#EF4444" stroke="#7F1D1D" strokeWidth="0.35" />
    </svg>
  )
}
