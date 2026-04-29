'use client'

import { useMemo, useState } from 'react'
import CountryFlag from '@/components/CountryFlag'
import SmartPrefetchLink from '@/components/navigation/SmartPrefetchLink'
import AdminSearchableTable from '@/components/admin/AdminSearchableTable'
import type { AdminTableColumn } from '@/components/admin/AdminTable'
import type { AdminPersonListItem } from '@/lib/db/people'
import { getPersonDisplayName } from '@/lib/db/people'
import PitchIcon from '@/components/icons/PitchIcon'
import ClockIcon from '@/components/icons/ClockIcon'
import { GoalIcon, AssistIcon, YellowCardIcon, RedCardIcon } from '@/components/icons'
import BenchIcon from '@/components/icons/BenchIcon'
import SortableStatHeader from '@/components/admin/SortableStatHeader'

export type PeopleCardVariant = 'players' | 'coaches' | 'referees'

function getAgeDisplay(person: AdminPersonListItem): string | null {
  if (!person.birth_date) return null
  const birth = new Date(person.birth_date)
  const ref = person.death_date ? new Date(person.death_date) : new Date()
  let age = ref.getFullYear() - birth.getFullYear()
  const m = ref.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--
  return person.death_date ? null : `(${age} l.)`
}

function getRoleForVariant(variant: PeopleCardVariant): 'PLAYER' | 'COACH' | 'REFEREE' {
  if (variant === 'coaches') return 'COACH'
  if (variant === 'referees') return 'REFEREE'
  return 'PLAYER'
}

function getMatchCountForVariant(person: AdminPersonListItem, variant: PeopleCardVariant): number {
  if (variant === 'coaches') return person.coach_match_count
  if (variant === 'referees') return person.referee_match_count
  return person.player_match_count
}

export default function PeopleSearchTable({
  people,
  basePath = '/admin/people',
  variant = 'players',
  showCountryFilter = true,
  defaultCountryFilter,
}: {
  people: AdminPersonListItem[]
  basePath?: string
  variant?: PeopleCardVariant
  showCountryFilter?: boolean
  defaultCountryFilter?: string
}) {
  type PlayerSortKey = 'appearance_count' | 'goal_count' | 'assist_count' | 'yellow_card_count' | 'red_card_count' | 'minute_count' | 'bench_count'
  type CoachSortKey = 'coach_match_count' | 'coach_wins' | 'coach_draws' | 'coach_losses' | 'coach_goals_scored' | 'coach_goals_conceded' | 'coach_points_per_match'
  const [sortKey, setSortKey] = useState<PlayerSortKey>('appearance_count')
  const [coachSortKey, setCoachSortKey] = useState<CoachSortKey>('coach_match_count')
  const role = getRoleForVariant(variant)

  const roleFiltered = useMemo(
    () => people.filter((person) => person.roles.includes(role)),
    [people, role]
  )

  const sorted = useMemo(() => {
    if (variant === 'coaches') {
      return [...roleFiltered].sort((a, b) => (b[coachSortKey] as number) - (a[coachSortKey] as number))
    }
    if (variant !== 'players') {
      return [...roleFiltered].sort((a, b) => getMatchCountForVariant(b, variant) - getMatchCountForVariant(a, variant))
    }
    return [...roleFiltered].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number))
  }, [roleFiltered, sortKey, coachSortKey, variant])

  function coachStatHeader(key: CoachSortKey, content: React.ReactNode, label: string) {
    return <SortableStatHeader active={coachSortKey === key} onClick={() => setCoachSortKey(key)} icon={content} label={label} />
  }

  function statHeader(key: PlayerSortKey, icon: React.ReactNode, label: string) {
    return <SortableStatHeader active={sortKey === key} onClick={() => setSortKey(key)} icon={icon} label={label} />
  }

  function renderStatBadge(value: number) {
    return value > 0
      ? <span className="stat-badge inline-flex min-w-[2rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{value}</span>
      : <span className="text-sm text-neutral-600">–</span>
  }

  function renderCoachPointsPerMatchBadge(value: number) {
    return <span className="stat-badge inline-flex min-w-[3rem] items-center justify-center rounded border border-neutral-600/60 light:border-neutral-300 bg-gradient-to-b from-neutral-700 to-neutral-900 light:from-neutral-100 light:to-neutral-200 px-1.5 py-0.5 shadow-sm ring-1 ring-inset ring-white/5 light:ring-black/10 font-barlow text-[0.9rem] font-semibold text-neutral-200 light:text-neutral-900">{value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
  }

  const baseColumns: AdminTableColumn<AdminPersonListItem>[] = [
    {
      key: 'index',
      label: '',
      render: (_, index) => index + 1,
      className: 'text-neutral-500 w-8 pr-2',
    },
    {
      key: 'person',
      label: '',
      render: (person) => (
        <div className="flex items-center gap-2.5">
          {person.represented_country_fifa_codes.length > 0 ? (
            <div className="flex items-center gap-0.5">
              {person.represented_country_names.map((name, i) => (
                <CountryFlag
                  key={`${name}-${i}`}
                  fifaCode={person.represented_country_fifa_codes[i] ?? null}
                  countryName={name}
                  className="h-3.5 w-[21px] shrink-0"
                />
              ))}
            </div>
          ) : (
            <span className="inline-block h-3.5 w-[21px] shrink-0" />
          )}
          <SmartPrefetchLink
            href={`${basePath}/${person.id}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
          >
            {getPersonDisplayName(person)}
            {person.death_date && (
              <span className="font-black text-neutral-500">&#x2020;</span>
            )}
            {getAgeDisplay(person) && (
              <span className="text-neutral-500 font-normal">{getAgeDisplay(person)}</span>
            )}
          </SmartPrefetchLink>
        </div>
      ),
      // min-w zapewnia stały układ kolumn stat niezależnie od długości nazwy (punkt odniesienia: widok wszystkich krajów w filtrze)
      // spójne z analogicznym ustawieniem w CountriesSearchTable i ClubsSearchTable
      className: 'font-medium pl-2 min-w-[440px]',
    },
  ]

  const columns: AdminTableColumn<AdminPersonListItem>[] = useMemo(() => {
    if (variant !== 'players') {
      return [
        ...baseColumns,
        {
          key: 'matches',
          label: 'Mecze',
          headerRender: () => (
            variant === 'coaches'
              ? coachStatHeader('coach_match_count', <PitchIcon className="h-5 w-5" />, 'Mecze')
              : <span className="inline-flex items-center"><PitchIcon className="h-5 w-5" /></span>
          ),
          render: (person) => renderStatBadge(getMatchCountForVariant(person, variant)),
          className: 'text-center px-1!',
        },
        ...(variant === 'coaches' ? [
          {
            key: 'coach_wins',
            label: 'Z',
            headerRender: () => coachStatHeader('coach_wins', <span className="text-xs font-bold text-emerald-400">Z</span>, 'Zwycięstwa'),
            render: (person: AdminPersonListItem) => renderStatBadge(person.coach_wins),
            className: 'text-center px-1!',
          },
          {
            key: 'coach_draws',
            label: 'R',
            headerRender: () => coachStatHeader('coach_draws', <span className="text-xs font-bold text-amber-400">R</span>, 'Remisy'),
            render: (person: AdminPersonListItem) => renderStatBadge(person.coach_draws),
            className: 'text-center px-1!',
          },
          {
            key: 'coach_losses',
            label: 'P',
            headerRender: () => coachStatHeader('coach_losses', <span className="text-xs font-bold text-red-400">P</span>, 'Porażki'),
            render: (person: AdminPersonListItem) => renderStatBadge(person.coach_losses),
            className: 'text-center px-1!',
          },
          {
            key: 'coach_goals_scored',
            label: 'G+',
            headerRender: () => coachStatHeader('coach_goals_scored', <span className="text-xs font-bold text-emerald-300">G+</span>, 'Bramki strzelone'),
            render: (person: AdminPersonListItem) => renderStatBadge(person.coach_goals_scored),
            className: 'text-center px-1!',
          },
          {
            key: 'coach_goals_conceded',
            label: 'G-',
            headerRender: () => coachStatHeader('coach_goals_conceded', <span className="text-xs font-bold text-rose-300">G-</span>, 'Bramki stracone'),
            render: (person: AdminPersonListItem) => renderStatBadge(person.coach_goals_conceded),
            className: 'text-center px-1!',
          },
          {
            key: 'coach_points_per_match',
            label: 'ŚR.P.',
            headerRender: () => coachStatHeader('coach_points_per_match', <span className="text-xs font-bold text-sky-300">ŚR.P.</span>, 'Średnia liczba punktów na mecz'),
            render: (person: AdminPersonListItem) => renderCoachPointsPerMatchBadge(person.coach_points_per_match),
            className: 'text-center px-1!',
          },
        ] as AdminTableColumn<AdminPersonListItem>[] : []),
      ]
    }

    return [
      ...baseColumns,
      {
        key: 'appearances',
        label: 'Występy',
        headerRender: () => statHeader('appearance_count', <PitchIcon className="h-5 w-5" />, 'Występy'),
        render: (person) => renderStatBadge(person.appearance_count),
        className: 'text-center px-1!',
      },
      {
        key: 'goals',
        label: 'Bramki',
        headerRender: () => statHeader('goal_count', <GoalIcon className="h-5 w-5" />, 'Bramki'),
        render: (person) => renderStatBadge(person.goal_count),
        className: 'text-center px-1!',
      },
      {
        key: 'assists',
        label: 'Asysty',
        headerRender: () => statHeader('assist_count', <AssistIcon className="h-5 w-5" />, 'Asysty'),
        render: (person) => renderStatBadge(person.assist_count),
        className: 'text-center px-1!',
      },
      {
        key: 'yellow_cards',
        label: 'Żółte kartki',
        headerRender: () => statHeader('yellow_card_count', <YellowCardIcon className="h-5 w-5" />, 'Żółte kartki'),
        render: (person) => renderStatBadge(person.yellow_card_count),
        className: 'text-center px-1!',
      },
      {
        key: 'red_cards',
        label: 'Czerwone kartki',
        headerRender: () => statHeader('red_card_count', <RedCardIcon className="h-5 w-5" />, 'Czerwone kartki'),
        render: (person) => renderStatBadge(person.red_card_count),
        className: 'text-center px-1!',
      },
      {
        key: 'bench',
        label: 'Ławka',
        headerRender: () => statHeader('bench_count', <BenchIcon className="h-5 w-5" />, 'Ławka rezerwowych'),
        render: (person) => renderStatBadge(person.bench_count),
        className: 'text-center px-1!',
      },
      {
        key: 'minutes',
        label: 'Minuty',
        headerRender: () => statHeader('minute_count', <ClockIcon className="h-5 w-5" />, 'Minuty'),
        render: (person) => renderStatBadge(person.minute_count),
        className: 'text-center px-1!',
      },
    ]
  }, [baseColumns, sortKey, coachSortKey, variant])

  return (
    <AdminSearchableTable
      data={sorted}
      columns={columns}
      searchPlaceholder="Wpisz imię, nazwisko albo pseudonim..."
      showHeader={true}
      emptyMessage="Brak osób w bazie danych."
      emptySearchMessage="Brak osób pasujących do wyszukiwanej frazy."
      getPrimaryText={(person) => getPersonDisplayName(person)}
      getSecondaryTexts={(person) => [
        person.nickname,
        person.birth_city_name,
        person.birth_country_name,
        ...person.coached_country_names,
        ...person.represented_country_names,
      ]}
      filterConfig={showCountryFilter ? {
        label: '',
        allLabel: 'Wszystkie kraje',
        getValue: (person) => {
          if (variant === 'coaches') {
            return person.coached_country_names
          }
          return person.represented_country_names.length > 0
            ? person.represented_country_names
            : person.birth_country_name
        },
      } : undefined}
      filterWidthClass="md:w-52"
      defaultFilter={defaultCountryFilter}
      searchIgnoresFilters
    />
  )
}
