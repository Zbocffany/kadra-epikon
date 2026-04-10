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
      <text
        x="12"
        y="19"
        textAnchor="middle"
        fontSize="20"
        fontWeight="900"
        fill="currentColor"
        fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
      >
        A
      </text>
    </svg>
  )
}
