import type { SVGProps } from 'react'

export default function GoalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <image href="/icons/goal.png" x="0" y="0" width="24" height="24" preserveAspectRatio="xMidYMid meet" />
    </svg>
  )
}
