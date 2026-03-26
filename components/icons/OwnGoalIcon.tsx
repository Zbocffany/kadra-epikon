import type { SVGProps } from 'react'

export default function OwnGoalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="8.2" fill="#DC2626" stroke="#7F1D1D" strokeWidth="1.2" />
      <path
        d="M12 7.2L14.6 9L13.6 12L10.4 12L9.4 9L12 7.2Z"
        fill="#FCA5A5"
        stroke="#7F1D1D"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <path d="M12 7.2V4.8" stroke="#7F1D1D" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M9.4 9L7.1 7.7" stroke="#7F1D1D" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M14.6 9L16.9 7.7" stroke="#7F1D1D" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M10.4 12L8.6 14.8" stroke="#7F1D1D" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M13.6 12L15.4 14.8" stroke="#7F1D1D" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M9.2 16.4L7.6 17.8" stroke="#7F1D1D" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M14.8 16.4L16.4 17.8" stroke="#7F1D1D" strokeWidth="0.9" strokeLinecap="round" />
      <circle cx="9" cy="8" r="0.7" fill="#FDE68A" opacity="0.8" />
    </svg>
  )
}