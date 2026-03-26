import type { ReactElement, SVGProps } from 'react'
import AssistIcon from './AssistIcon'
import GoalIcon from './GoalIcon'
import MissedPenaltyIcon from './MissedPenaltyIcon'
import OwnGoalIcon from './OwnGoalIcon'
import PenaltyGoalIcon from './PenaltyGoalIcon'
import RedCardIcon from './RedCardIcon'
import SavedPenaltyIcon from './SavedPenaltyIcon'
import SecondYellowCardIcon from './SecondYellowCardIcon'
import SubstitutionIcon from './SubstitutionIcon'
import YellowCardIcon from './YellowCardIcon'

export type AppIconName = 'goal' | 'ownGoal' | 'penaltyGoal' | 'missedPenalty' | 'savedPenalty' | 'yellowCard' | 'secondYellowCard' | 'redCard' | 'substitution' | 'assist'

type IconComponent = (props: SVGProps<SVGSVGElement>) => ReactElement

export const ICON_REGISTRY: Record<AppIconName, IconComponent> = {
  assist: AssistIcon,
  goal: GoalIcon,
  missedPenalty: MissedPenaltyIcon,
  ownGoal: OwnGoalIcon,
  penaltyGoal: PenaltyGoalIcon,
  savedPenalty: SavedPenaltyIcon,
  yellowCard: YellowCardIcon,
  secondYellowCard: SecondYellowCardIcon,
  redCard: RedCardIcon,
  substitution: SubstitutionIcon,
}
