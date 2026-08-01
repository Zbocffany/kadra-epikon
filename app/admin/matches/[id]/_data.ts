import { notFound } from 'next/navigation'

import type { MatchEventPersonOption } from './MatchEventsForm'

import {
  getAdminClubTeamOptions,
  getAdminMatchCreateOptions,
  getAdminMatchDetails,
  getAdminMatchEvents,
  getAdminMatchParticipants,
  getLatestPlayerClubTeamByPersonIds,
  getLatestPlayerPositionByPersonIds,
} from '@/lib/db/matches'
import { getAdminPersonBirthCityOptions } from '@/lib/db/people'
import { getAdminCountriesOptions } from '@/lib/db/cities'
import { getAdminFederations } from '@/lib/db/countries'

/**
 * Wynik ładowania strony `/admin/matches/[id]`. Ekstrakcja z page.tsx —
 * strona była wielokrotnie ładowana + wielokrotne `Promise.all`.
 * Loader trzyma logikę I/O + lekką derywację (`eventPeople`) w jednym miejscu.
 *
 * Ładowanie odbywa się w 3 fazach:
 * 1) `match` (potrzebne żeby zweryfikować istnienie i użyć `match_date` niżej)
 * 2) Dwie równoległe grupy zapytań: (options, participants, events)
 *    oraz (cities, countries, federations, clubTeams). Rozdzielone celowo,
 *    żeby nie przekroczyć limitu połączeń do Supabase w lokalu.
 * 3) `latestPlayerClubTeamByPersonId` + `latestPlayerPositionByPersonId` —
 *    zależą od `personIds` z participants, więc muszą być po fazie 2.
 *
 * Ta funkcja wywołuje `notFound()` gdy mecz nie istnieje.
 */
export type AdminMatchPageData = {
  match: NonNullable<Awaited<ReturnType<typeof getAdminMatchDetails>>>
  options: Awaited<ReturnType<typeof getAdminMatchCreateOptions>>
  participants: Awaited<ReturnType<typeof getAdminMatchParticipants>>
  events: Awaited<ReturnType<typeof getAdminMatchEvents>>
  cities: Awaited<ReturnType<typeof getAdminPersonBirthCityOptions>>
  countries: Awaited<ReturnType<typeof getAdminCountriesOptions>>
  federations: Awaited<ReturnType<typeof getAdminFederations>>
  clubTeams: Awaited<ReturnType<typeof getAdminClubTeamOptions>>
  latestPlayerClubTeamByPersonId: Awaited<ReturnType<typeof getLatestPlayerClubTeamByPersonIds>>
  latestPlayerPositionByPersonId: Awaited<ReturnType<typeof getLatestPlayerPositionByPersonIds>>
  eventPeople: MatchEventPersonOption[]
}

export async function loadAdminMatchPageData(id: string): Promise<AdminMatchPageData> {
  const match = await getAdminMatchDetails(id)
  if (!match) notFound()

  // Split into two sequential batches to avoid overwhelming Supabase connection
  // limits in local dev. Nie łączyć w jeden Promise.all bez re-testu limitów.
  const [options, participants, events] = await Promise.all([
    getAdminMatchCreateOptions(),
    getAdminMatchParticipants(match),
    getAdminMatchEvents(match.id),
  ])
  const [cities, countries, federations, clubTeams] = await Promise.all([
    getAdminPersonBirthCityOptions(),
    getAdminCountriesOptions(),
    getAdminFederations(),
    getAdminClubTeamOptions(),
  ])

  const personIds = participants.people.map((person) => person.id)
  const [latestPlayerClubTeamByPersonId, latestPlayerPositionByPersonId] = await Promise.all([
    getLatestPlayerClubTeamByPersonIds(personIds, {
      excludeMatchId: match.id,
      targetMatchDate: match.match_date,
    }),
    getLatestPlayerPositionByPersonIds(personIds, { excludeMatchId: match.id }),
  ])

  // Zbierz osoby, które mogą wystąpić w zdarzeniach — łączymy zawodników obu drużyn
  // i sędziów, deduplikując po person_id. team_ids to lista drużyn, w których dana
  // osoba jest uczestnikiem meczu (potrzebne do zawężania listy w `MatchEventsForm`).
  const eventPeopleById = new Map<string, MatchEventPersonOption>()
  for (const participant of [
    ...participants.homeParticipants,
    ...participants.awayParticipants,
    ...participants.referees,
  ]) {
    const existing = eventPeopleById.get(participant.person_id)
    const nextTeamIds = participant.team_id
      ? (existing?.teamIds.includes(participant.team_id)
          ? existing.teamIds
          : [...(existing?.teamIds ?? []), participant.team_id])
      : (existing?.teamIds ?? [])

    eventPeopleById.set(participant.person_id, {
      id: participant.person_id,
      label: participant.person_name,
      teamIds: nextTeamIds,
    })
  }
  const eventPeople = [...eventPeopleById.values()]
    .sort((a, b) => a.label.localeCompare(b.label, 'pl'))

  return {
    match,
    options,
    participants,
    events,
    cities,
    countries,
    federations,
    clubTeams,
    latestPlayerClubTeamByPersonId,
    latestPlayerPositionByPersonId,
    eventPeople,
  }
}
