import type { SVGProps } from 'react'
import { ICON_REGISTRY, type AppIconName } from './registry'

type IconProps = SVGProps<SVGSVGElement> & {
  name: AppIconName
}

export default function Icon({ name, ...props }: IconProps) {
  const Svg = ICON_REGISTRY[name]
  return <Svg {...props} />
}
