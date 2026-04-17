import { notFound } from 'next/navigation'
import MatchReadOnlyPage from '@/components/matches/MatchReadOnlyPage'
import { getAdminMatchEvents, getPublicMatchDetails, getPublicMatchParticipants } from '@/lib/db/matches'
import { getAdminCityDetails } from '@/lib/db/cities'
import { getAdminStadiumDetails } from '@/lib/db/stadiums'

export const revalidate = 86400

type Params = Promise<{ id: string }>

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-')
  return `${day}.${month}.${year}`
}

function buildStadiumSummary(stadiumName: string | null, stadiumCityName: string | null, fallbackCityName: string | null) {
  const cityName = stadiumCityName ?? fallbackCityName
  if (!stadiumName) return cityName

  if (!cityName) return stadiumName

  const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  return normalize(stadiumName).includes(normalize(cityName)) ? stadiumName : `${stadiumName} (${cityName})`
}

export default async function PublicMatchDetailsPage({ params }: { params: Params }) {
  const { id } = await params
  const match = await getPublicMatchDetails(id)

  if (!match) {
    notFound()
  }

  const [participants, events, cityDetails, stadiumDetails] = await Promise.all([
    getPublicMatchParticipants(match),
    getAdminMatchEvents(match.id),
    match.match_city_id ? getAdminCityDetails(match.match_city_id) : Promise.resolve(null),
    match.match_stadium_id ? getAdminStadiumDetails(match.match_stadium_id) : Promise.resolve(null),
  ])

  const matchDateTimeLabel = `${formatDate(match.match_date)}${match.match_time ? ` ${match.match_time.slice(0, 5)}` : ''}`
  const stadiumSummary = buildStadiumSummary(
    stadiumDetails?.name ?? null,
    stadiumDetails?.city_name ?? null,
    cityDetails?.city_name ?? null,
  )

  return (
    <MatchReadOnlyPage
      match={match}
      participants={participants}
      events={events}
      backHref="/matches"
      backLabel="Powrót do listy meczów"
      competitionName={match.competition_name}
      matchDateTimeLabel={matchDateTimeLabel}
      stadiumSummary={stadiumSummary}
    />
  )
}