'use client'

import { useState } from 'react'
import Link from 'next/link'
import type {
  AdminCityOption,
  AdminCompetitionOption,
  AdminStadiumOption,
  AdminTeamOption,
} from '@/lib/db/matches'

type MatchCreateModalProps = {
  competitions: AdminCompetitionOption[]
  teams: AdminTeamOption[]
  cities: AdminCityOption[]
  stadiums: AdminStadiumOption[]
  createAction: (formData: FormData) => Promise<void>
}

export default function MatchCreateModal({
  competitions,
  teams,
  cities,
  stadiums,
  createAction,
}: MatchCreateModalProps) {
  const [selectedStadiumId, setSelectedStadiumId] = useState('')
  const [selectedCityId, setSelectedCityId] = useState('')
  const [homeTeamId, setHomeTeamId] = useState('')
  const [awayTeamId, setAwayTeamId] = useState('')

  const handleStadiumChange = (stadiumId: string) => {
    setSelectedStadiumId(stadiumId)

    if (!stadiumId) {
      return
    }

    const stadium = stadiums.find((item) => item.id === stadiumId)
    if (stadium?.stadium_city_id) {
      setSelectedCityId(stadium.stadium_city_id)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="w-full max-w-2xl rounded-xl border border-neutral-700 bg-neutral-950 p-6 shadow-2xl">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-neutral-100">Dodaj mecz</h2>
        </div>

        <form action={createAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="match_date" className="text-sm font-medium text-neutral-300">
                Data meczu <span className="text-red-400">*</span>
              </label>
              <input
                id="match_date"
                name="match_date"
                type="date"
                required
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="match_time" className="text-sm font-medium text-neutral-300">
                Godzina
              </label>
              <input
                id="match_time"
                name="match_time"
                type="time"
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
              />
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label htmlFor="competition_id" className="text-sm font-medium text-neutral-300">
                Rozgrywki <span className="text-red-400">*</span>
              </label>
              <select
                id="competition_id"
                name="competition_id"
                required
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
              >
                <option value="">— wybierz —</option>
                {competitions.map((competition) => (
                  <option key={competition.id} value={competition.id}>
                    {competition.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="match_stadium_id" className="text-sm font-medium text-neutral-300">
                Stadion
              </label>
              <select
                id="match_stadium_id"
                name="match_stadium_id"
                value={selectedStadiumId}
                onChange={(event) => handleStadiumChange(event.target.value)}
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
              >
                <option value="">— brak —</option>
                {stadiums.map((stadium) => (
                  <option key={stadium.id} value={stadium.id}>
                    {stadium.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="match_city_id" className="text-sm font-medium text-neutral-300">
                Miasto meczu
              </label>
              <select
                id="match_city_id"
                name="match_city_id"
                value={selectedCityId}
                onChange={(event) => setSelectedCityId(event.target.value)}
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
              >
                <option value="">— brak —</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-neutral-500">
                Wybór stadionu automatycznie ustawia miasto meczu.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="home_team_id" className="text-sm font-medium text-neutral-300">
                Gospodarz <span className="text-red-400">*</span>
              </label>
              <select
                id="home_team_id"
                name="home_team_id"
                required
                value={homeTeamId}
                onChange={(event) => setHomeTeamId(event.target.value)}
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
              >
                <option value="">— wybierz —</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id} disabled={awayTeamId === team.id}>
                    {team.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="away_team_id" className="text-sm font-medium text-neutral-300">
                Gość <span className="text-red-400">*</span>
              </label>
              <select
                id="away_team_id"
                name="away_team_id"
                required
                value={awayTeamId}
                onChange={(event) => setAwayTeamId(event.target.value)}
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
              >
                <option value="">— wybierz —</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id} disabled={homeTeamId === team.id}>
                    {team.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="submit"
              className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-white"
            >
              Dodaj mecz
            </button>
            <Link
              href="/admin/matches"
              className="rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
            >
              Zamknij
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
