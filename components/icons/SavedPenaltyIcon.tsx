import type { SVGProps } from 'react'

export default function SavedPenaltyIcon(props: SVGProps<SVGSVGElement>) {
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
        stroke="#EF4444"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M7.5 18.5V11.5" stroke="#FCA5A5" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M12 18.5V11.5" stroke="#FCA5A5" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M16.5 18.5V11.5" stroke="#FCA5A5" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M6.2 11.5H17.8" stroke="#FCA5A5" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M5.4 14.7H18.6" stroke="#FCA5A5" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M4.5 18.5H19.5" stroke="#EF4444" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}