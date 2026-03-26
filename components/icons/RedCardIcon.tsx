import type { SVGProps } from 'react'

export default function RedCardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <g transform="translate(-1 -1) scale(1.1)">
        <g transform="rotate(-6 12 12)">
          <rect
            x="7.6"
            y="5.3"
            width="9.8"
            height="13.2"
            rx="1.7"
            fill="#DC2626"
            stroke="#7F1D1D"
            strokeWidth="1"
          />
        </g>
      </g>
    </svg>
  )
}