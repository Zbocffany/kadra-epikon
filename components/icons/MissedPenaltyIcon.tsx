import type { SVGProps } from 'react'

export default function MissedPenaltyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M4.5 18.5V8.5H19.5V18.5"
        stroke="#E5E7EB"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M7.5 18.5V11.5" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M12 18.5V11.5" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M16.5 18.5V11.5" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M6.2 11.5H17.8" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M5.4 14.7H18.6" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M4.5 18.5H19.5" stroke="#E5E7EB" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M15.6 6.3L20.4 11.1" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
      <path d="M20.4 6.3L15.6 11.1" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}