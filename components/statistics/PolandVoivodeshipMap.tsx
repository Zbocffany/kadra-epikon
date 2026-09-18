'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { geoMercator, geoPath } from 'd3-geo'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import Link from 'next/link'
import type { PolandPlayerUnknownVoivodeship, PolandVoivodeshipStat } from '@/lib/db/polandStats'

const WIDTH = 820
const HEIGHT = 720

type VoivodeshipMetric =
  | 'players'
  | 'appearances'
  | 'goals'
  | 'yellowCards'
  | 'redCards'
  | 'clubs'

type MetricConfig = {
  key: VoivodeshipMetric
  label: string
  legend: string
  getValue: (statistic: PolandVoivodeshipStat) => number
}

const METRIC_CONFIG: MetricConfig[] = [
  {
    key: 'players',
    label: 'Reprezentanci',
    legend: 'Liczba reprezentantów Polski urodzonych w województwie',
    getValue: (statistic) => statistic.playerCount,
  },
  {
    key: 'appearances',
    label: 'Występy',
    legend: 'Suma występów zawodników z województwa w reprezentacji Polski',
    getValue: (statistic) => statistic.appearanceCount,
  },
  {
    key: 'goals',
    label: 'Gole',
    legend: 'Suma bramek strzelonych dla reprezentacji Polski',
    getValue: (statistic) => statistic.goalCount,
  },
  {
    key: 'yellowCards',
    label: 'Żółte kartki',
    legend: 'Suma żółtych kartek w reprezentacji Polski',
    getValue: (statistic) => statistic.yellowCardCount,
  },
  {
    key: 'redCards',
    label: 'Czerwone kartki',
    legend: 'Bezpośrednie czerwone + druga żółta',
    getValue: (statistic) => statistic.redCardCount,
  },
  {
    key: 'clubs',
    label: 'Kluby',
    legend: 'Liczba klubów, w których byli zgłoszeni reprezentanci Polski',
    getValue: (statistic) => statistic.clubCount,
  },
]

// Nazwa w GeoJSON (małą literą) → wartość enuma voivodeship_enum
// (identyczna, ale pierwsza litera duża — zgodnie z definicją enuma w bazie).
const NAME_TO_CODE: Record<string, string> = {
  'dolnośląskie': 'Dolnośląskie',
  'kujawsko-pomorskie': 'Kujawsko-pomorskie',
  'lubelskie': 'Lubelskie',
  'lubuskie': 'Lubuskie',
  'łódzkie': 'Łódzkie',
  'małopolskie': 'Małopolskie',
  'mazowieckie': 'Mazowieckie',
  'opolskie': 'Opolskie',
  'podkarpackie': 'Podkarpackie',
  'podlaskie': 'Podlaskie',
  'pomorskie': 'Pomorskie',
  'śląskie': 'Śląskie',
  'świętokrzyskie': 'Świętokrzyskie',
  'warmińsko-mazurskie': 'Warmińsko-mazurskie',
  'wielkopolskie': 'Wielkopolskie',
  'zachodniopomorskie': 'Zachodniopomorskie',
}

// Etykieta rysowana na mapie — trzymamy formę z małej litery zgodnie z GeoJSON.
const CODE_TO_DISPLAY: Record<string, string> = {
  'Dolnośląskie': 'dolnośląskie',
  'Kujawsko-pomorskie': 'kujawsko-pomorskie',
  'Lubelskie': 'lubelskie',
  'Lubuskie': 'lubuskie',
  'Łódzkie': 'łódzkie',
  'Małopolskie': 'małopolskie',
  'Mazowieckie': 'mazowieckie',
  'Opolskie': 'opolskie',
  'Podkarpackie': 'podkarpackie',
  'Podlaskie': 'podlaskie',
  'Pomorskie': 'pomorskie',
  'Śląskie': 'śląskie',
  'Świętokrzyskie': 'świętokrzyskie',
  'Warmińsko-mazurskie': 'warmińsko-mazurskie',
  'Wielkopolskie': 'wielkopolskie',
  'Zachodniopomorskie': 'zachodniopomorskie',
  'NIEZNANE': 'nieznane',
}

function getFill(value: number, maxValue: number): string {
  if (value <= 0 || maxValue <= 0) return '#ffffff'
  const intensity = Math.sqrt(value / maxValue)
  const lightness = 92 - intensity * 56
  return `hsl(145 58% ${lightness}%)`
}

type VoivodeshipFeature = Feature<Geometry, { nazwa?: string }>

export default function PolandVoivodeshipMap({
  statistics,
  unknownPlayers,
}: {
  statistics: PolandVoivodeshipStat[]
  unknownPlayers: PolandPlayerUnknownVoivodeship[]
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [features, setFeatures] = useState<VoivodeshipFeature[]>([])
  const [metric, setMetric] = useState<VoivodeshipMetric>('players')
  const [hoveredCode, setHoveredCode] = useState<string | null>(null)

  const activeMetric = useMemo(
    () => METRIC_CONFIG.find((entry) => entry.key === metric) ?? METRIC_CONFIG[0],
    [metric],
  )

  const statisticByCode = useMemo(
    () => new Map(statistics.map((statistic) => [statistic.voivodeshipCode, statistic])),
    [statistics],
  )

  const nieznaneStatistic = statisticByCode.get('NIEZNANE') ?? null

  useEffect(() => {
    let active = true
    void fetch('/maps/poland-voivodeships.geojson')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<FeatureCollection<Geometry, { nazwa?: string }>>
      })
      .then((collection) => {
        if (!active) return
        setFeatures(collection.features)
      })
      .catch((error: unknown) => {
        console.error('[PolandVoivodeshipMap] Nie udało się wczytać granic województw:', error)
      })
    return () => {
      active = false
    }
  }, [])

  const projection = useMemo(() => {
    if (features.length === 0) return null
    return geoMercator().fitExtent(
      [[16, 16], [WIDTH - 16, HEIGHT - 16]],
      { type: 'FeatureCollection', features } as FeatureCollection<Geometry>,
    )
  }, [features])

  const path = useMemo(() => (projection ? geoPath(projection) : null), [projection])

  const maxValue = useMemo(() => {
    let max = 0
    for (const statistic of statistics) {
      if (statistic.voivodeshipCode === 'NIEZNANE') continue
      const value = activeMetric.getValue(statistic)
      if (value > max) max = value
    }
    return max
  }, [statistics, activeMetric])

  const renderFeatures = useMemo(() => {
    return features
      .map((mapFeature) => {
        const rawName = (mapFeature.properties?.nazwa ?? '').trim().toLowerCase()
        const code = NAME_TO_CODE[rawName] ?? null
        return { key: rawName || 'unknown', code, feature: mapFeature }
      })
      .filter((entry) => entry.code !== null) as Array<{
        key: string
        code: string
        feature: VoivodeshipFeature
      }>
  }, [features])

  const orderedFeatures = useMemo(() => {
    if (!hoveredCode) return renderFeatures
    return [...renderFeatures].sort((left, right) => {
      const leftHovered = left.code === hoveredCode ? 1 : 0
      const rightHovered = right.code === hoveredCode ? 1 : 0
      return leftHovered - rightHovered
    })
  }, [hoveredCode, renderFeatures])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {METRIC_CONFIG.map((entry) => {
          const isActive = entry.key === metric
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => setMetric(entry.key)}
              aria-pressed={isActive}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-emerald-700 bg-emerald-700 text-white shadow-sm'
                  : 'border-neutral-300 bg-white text-neutral-800 hover:border-emerald-600 hover:text-emerald-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:text-emerald-300'
              }`}
            >
              {entry.label}
            </button>
          )
        })}
      </div>

      <p className="text-sm text-neutral-600 dark:text-neutral-300">
        {activeMetric.legend}. Wartość liczbowa na mapie odpowiada aktywnej metryce.
      </p>

      <div className="relative mx-auto w-full overflow-hidden border-y border-emerald-900/50 bg-[radial-gradient(circle_at_50%_35%,rgba(207,250,225,0.94),rgba(226,245,235,0.78)_42%,rgba(184,219,201,0.72)_100%)] sm:w-2/3 sm:rounded-md sm:border">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="block h-auto w-full"
          role="img"
          aria-label="Mapa Polski z podziałem na województwa — statystyki reprezentantów"
        >
          <rect width={WIDTH} height={HEIGHT} fill="transparent" />
          {path
            ? orderedFeatures.map((entry) => {
                const statistic = statisticByCode.get(entry.code)
                const value = statistic ? activeMetric.getValue(statistic) : 0
                const pathData = path(entry.feature)
                if (!pathData) return null
                const isHovered = entry.code === hoveredCode
                const centroid = path.centroid(entry.feature)
                const displayName = CODE_TO_DISPLAY[entry.code] ?? entry.code
                return (
                  <g key={entry.key}>
                    <path
                      d={pathData}
                      fill={getFill(value, maxValue)}
                      stroke={isHovered ? '#052e1b' : '#64756c'}
                      strokeWidth={isHovered ? 1.6 : 0.7}
                      vectorEffect="non-scaling-stroke"
                      className="transition-[filter] duration-150 ease-out"
                      style={{
                        filter: isHovered
                          ? 'drop-shadow(0 6px 6px rgba(0,0,0,0.34)) drop-shadow(0 2px 2px rgba(0,0,0,0.24)) brightness(1.06)'
                          : undefined,
                      }}
                      onPointerEnter={() => setHoveredCode(entry.code)}
                      onPointerLeave={() => setHoveredCode(null)}
                    />
                    {Number.isFinite(centroid[0]) && Number.isFinite(centroid[1]) && (
                      <g
                        pointerEvents="none"
                        transform={`translate(${centroid[0]}, ${centroid[1]})`}
                      >
                        <text
                          textAnchor="middle"
                          y={-4}
                          className="fill-neutral-900"
                          style={{
                            fontFamily: 'inherit',
                            fontSize: '11px',
                            fontWeight: 600,
                            paintOrder: 'stroke',
                            stroke: 'rgba(255,255,255,0.85)',
                            strokeWidth: 3,
                            strokeLinejoin: 'round',
                          }}
                        >
                          {displayName}
                        </text>
                        <text
                          textAnchor="middle"
                          y={12}
                          className="fill-emerald-950"
                          style={{
                            fontFamily: 'inherit',
                            fontSize: '13px',
                            fontWeight: 700,
                            paintOrder: 'stroke',
                            stroke: 'rgba(255,255,255,0.9)',
                            strokeWidth: 3,
                            strokeLinejoin: 'round',
                          }}
                        >
                          {value.toLocaleString('pl-PL')}
                        </text>
                      </g>
                    )}
                  </g>
                )
              })
            : null}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
        <span className="mr-1 font-semibold">{activeMetric.label}</span>
        {[0, 0.15, 0.35, 0.6, 1].map((value, index) => (
          <span key={value} className="inline-flex items-center gap-1.5">
            <span
              className="h-3.5 w-7 border border-neutral-400"
              style={{ background: getFill(value * maxValue, maxValue) }}
            />
            <span>
              {index === 0
                ? '0'
                : index === 4
                  ? maxValue.toLocaleString('pl-PL')
                  : `≈ ${Math.max(1, Math.round(value * maxValue)).toLocaleString('pl-PL')}`}
            </span>
          </span>
        ))}
      </div>

      {(nieznaneStatistic || unknownPlayers.length > 0) && (
        <section className="rounded-md border border-neutral-300 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <h3 className="font-barlow text-lg font-semibold text-neutral-950 dark:text-neutral-100">
            Polska — województwo nieznane
          </h3>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
            Reprezentanci urodzeni w Polsce, dla których nie znamy miasta lub województwa
            urodzenia.
          </p>

          {nieznaneStatistic && (
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {METRIC_CONFIG.map((entry) => (
                <div key={entry.key}>
                  <dt className="text-neutral-500 dark:text-neutral-400">{entry.label}</dt>
                  <dd className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    {entry.getValue(nieznaneStatistic).toLocaleString('pl-PL')}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {unknownPlayers.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-700">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Zawodnik</th>
                    <th className="px-3 py-2 font-semibold">Miasto urodzenia</th>
                    <th className="px-3 py-2 text-right font-semibold">Występy</th>
                    <th className="px-3 py-2 text-right font-semibold">Gole</th>
                  </tr>
                </thead>
                <tbody>
                  {unknownPlayers.map((player) => {
                    const displayName = [player.firstName, player.lastName]
                      .filter((part): part is string => Boolean(part && part.trim()))
                      .join(' ') || '(bez nazwiska)'
                    return (
                      <tr
                        key={player.personId}
                        className="border-t border-neutral-200 hover:bg-emerald-50/60 dark:border-neutral-800 dark:hover:bg-emerald-950/30"
                      >
                        <td className="px-3 py-2">
                          <Link
                            href={`/people/${player.personId}`}
                            className="font-medium text-emerald-800 hover:underline dark:text-emerald-300"
                          >
                            {displayName}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-neutral-700 dark:text-neutral-200">
                          {player.birthCityName ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-neutral-900 dark:text-neutral-100">
                          {player.appearanceCount.toLocaleString('pl-PL')}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-neutral-900 dark:text-neutral-100">
                          {player.goalCount.toLocaleString('pl-PL')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
