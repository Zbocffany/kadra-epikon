import type { SVGProps } from 'react'

export default function CardsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <g transform="translate(-1 -1) scale(1.1)">
        <g transform="rotate(-12 10 12)">
          <rect
            x="6.2"
            y="6.2"
            width="8.8"
            height="11.6"
            rx="1.6"
            fill="#FACC15"
            stroke="#A16207"
            strokeWidth="1"
          />
        </g>
        <g transform="rotate(14 14 12)">
          <rect
            x="10.2"
            y="5.2"
            width="8.8"
            height="11.6"
            rx="1.6"
            fill="#DC2626"
            stroke="#7F1D1D"
            strokeWidth="1"
          />
        </g>
      </g>
    </svg>
  )
}
