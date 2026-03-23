import type { SVGProps } from 'react'
import CardsIcon from './CardsIcon'
import GoalIcon from './GoalIcon'
import SubstitutionIcon from './SubstitutionIcon'

export type AppIconName = 'goal' | 'cards' | 'substitution'

type IconComponent = (props: SVGProps<SVGSVGElement>) => JSX.Element

export const ICON_REGISTRY: Record<AppIconName, IconComponent> = {
  cards: CardsIcon,
  goal: GoalIcon,
  substitution: SubstitutionIcon,
}
