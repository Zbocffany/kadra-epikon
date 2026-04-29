import type { SVGProps } from 'react'

export default function AssistIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      {/* circle with white fill and outline */}
      <circle cx="12" cy="12" r="10.25" stroke="currentColor" strokeWidth="1.5" fill="white" />
      {/* letter A — strokes only, no fill */}
      <path
        d="M8.5 17L12 7L15.5 17M9.8 13.8H14.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
