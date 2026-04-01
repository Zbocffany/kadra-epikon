type GlossyDisclosureCircleProps = {
  rotateClassName: string
  className?: string
}

export default function GlossyDisclosureCircle({ rotateClassName, className }: GlossyDisclosureCircleProps) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border border-neutral-500/80 bg-neutral-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_1px_rgba(0,0,0,0.55),0_1px_2px_rgba(0,0,0,0.65)] transition-transform duration-150 ${rotateClassName} ${className ?? ''}`.trim()}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.58)_0%,rgba(255,255,255,0.2)_32%,rgba(255,255,255,0)_60%),linear-gradient(130deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0)_50%)]"
      />
      <span className="relative z-10 h-0 w-0 border-x-[4px] border-x-transparent border-t-[6px] border-t-neutral-100 translate-y-[1px]" />
    </span>
  )
}