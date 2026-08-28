'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { geoEqualEarth, geoPath } from 'd3-geo'
import { select } from 'd3-selection'
import 'd3-transition'
import { zoom, zoomIdentity, type ZoomTransform } from 'd3-zoom'
import { feature } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import lookup from 'country-code-lookup'
import worldTopologyJson from 'world-atlas/countries-50m.json'
import type { PolandCountryStatistic } from '@/lib/db/statistics'
import {
  getCurrentFifaCodeForFlagAsset,
  isHistoricalFifaCode,
} from '@/lib/flags/fifaFlagMap'

const WIDTH = 1000
const HEIGHT = 520
const MAX_ZOOM = 8
const POLAND_FILL_ID = 'poland-flag-fill'

type TooltipState = {
  x: number
  y: number
  statistic: PolandCountryStatistic
}

type RenderFeature = {
  key: string
  fifaCode: string | null
  geometry: Feature<Geometry>
}

const HOME_NATION_FIFA_CODES: Record<string, string> = {
  ENG: 'ENG',
  NIR: 'NIR',
  SCT: 'SCO',
  WLS: 'WAL',
}

function getFeatureFifaCode(mapFeature: Feature<Geometry>): string | null {
  const country = lookup.byIso(Number(mapFeature.id))
  return getCurrentFifaCodeForFlagAsset(country?.iso2?.toLowerCase())
}

function normalizeD3PolygonWinding(geometry: Geometry): Geometry {
  if (geometry.type === 'Polygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((ring) => [...ring].reverse()),
    } satisfies Polygon
  }
  if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon) =>
        polygon.map((ring) => [...ring].reverse()),
      ),
    } satisfies MultiPolygon
  }
  return geometry
}

function splitFranceAndFrenchGuiana(mapFeature: Feature<Geometry>): RenderFeature[] {
  if (mapFeature.geometry.type !== 'MultiPolygon') {
    return [{ key: 'world-250', fifaCode: 'FRA', geometry: mapFeature }]
  }

  const frenchGuianaPolygons = mapFeature.geometry.coordinates.filter((polygon) =>
    polygon[0]?.some(([longitude, latitude]) => longitude < -40 && latitude < 10),
  )
  const francePolygons = mapFeature.geometry.coordinates.filter((polygon) =>
    !polygon[0]?.some(([longitude, latitude]) => longitude < -40 && latitude < 10),
  )

  return [
    {
      key: 'world-250',
      fifaCode: 'FRA',
      geometry: {
        ...mapFeature,
        geometry: { type: 'MultiPolygon', coordinates: francePolygons },
      },
    },
    {
      key: 'world-guf',
      fifaCode: 'GUF',
      geometry: {
        ...mapFeature,
        id: 'GUF',
        properties: { ...mapFeature.properties, name: 'French Guiana' },
        geometry: { type: 'MultiPolygon', coordinates: frenchGuianaPolygons },
      },
    },
  ]
}

function getFill(matches: number, maxMatches: number): string {
  if (matches <= 0 || maxMatches <= 0) return '#ffffff'
  const intensity = Math.sqrt(matches / maxMatches)
  const lightness = 92 - intensity * 56
  return `hsl(145 58% ${lightness}%)`
}

function getMatchCountLabel(matches: number): string {
  if (matches === 1) return 'mecz'
  const lastTwoDigits = matches % 100
  const lastDigit = matches % 10
  return lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)
    ? 'mecze'
    : 'meczów'
}

export default function WorldStatisticsMap({
  statistics,
}: {
  statistics: PolandCountryStatistic[]
}) {
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity)
  const [hoveredCode, setHoveredCode] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [homeNationFeatures, setHomeNationFeatures] = useState<RenderFeature[]>([])

  const statisticByFifaCode = useMemo(
    () => new Map(statistics.map((statistic) => [statistic.fifaCode, statistic])),
    [statistics],
  )

  const mapFeatures = useMemo(() => {
    const topology = worldTopologyJson as unknown as Topology<{
      countries: GeometryCollection<{ name: string }>
    }>
    const collection = feature(
      topology,
      topology.objects.countries,
    ) as FeatureCollection<Geometry, { name: string }>
    return collection.features.filter(
      (mapFeature) => mapFeature.id != null && Number(mapFeature.id) !== 10,
    )
  }, [])

  const projection = useMemo(
    () => geoEqualEarth().fitExtent([[12, 12], [WIDTH - 12, HEIGHT - 12]], {
      type: 'FeatureCollection',
      features: mapFeatures,
    }),
    [mapFeatures],
  )
  const path = useMemo(() => geoPath(projection), [projection])
  const maxMatches = Math.max(0, ...statistics.map((statistic) => statistic.matches))
  const historicalStatistics = statistics.filter(
    (statistic) => isHistoricalFifaCode(statistic.fifaCode) && statistic.matches > 0,
  )

  const renderFeatures = useMemo<RenderFeature[]>(() => [
    ...mapFeatures
      .filter((mapFeature) => Number(mapFeature.id) !== 826)
      .flatMap((mapFeature, featureIndex) => Number(mapFeature.id) === 250
        ? splitFranceAndFrenchGuiana(mapFeature)
        : [{
            key: `world-${String(mapFeature.id)}-${featureIndex}`,
            fifaCode: getFeatureFifaCode(mapFeature),
            geometry: mapFeature,
          }]),
    ...homeNationFeatures,
  ], [homeNationFeatures, mapFeatures])

  const orderedFeatures = useMemo(() => {
    if (!hoveredCode) return renderFeatures
    return [...renderFeatures].sort((left, right) => {
      const leftHovered = left.fifaCode === hoveredCode ? 1 : 0
      const rightHovered = right.fifaCode === hoveredCode ? 1 : 0
      return leftHovered - rightHovered
    })
  }, [hoveredCode, renderFeatures])

  useEffect(() => {
    let active = true

    void fetch('/maps/uk-home-nations.geojson')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<FeatureCollection<Geometry, { gu_a3?: string }>>
      })
      .then((collection) => {
        if (!active) return
        setHomeNationFeatures(collection.features.flatMap((homeNation) => {
          const sourceCode = homeNation.properties?.gu_a3?.trim().toUpperCase() ?? ''
          const fifaCode = HOME_NATION_FIFA_CODES[sourceCode]
          return fifaCode
            ? [{
                key: `home-nation-${fifaCode}`,
                fifaCode,
                geometry: {
                  ...homeNation,
                  geometry: normalizeD3PolygonWinding(homeNation.geometry),
                },
              }]
            : []
        }))
      })
      .catch((error: unknown) => {
        console.error('[WorldStatisticsMap] Nie udało się wczytać granic home nations:', error)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!svgRef.current) return

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, MAX_ZOOM])
      .translateExtent([[0, 0], [WIDTH, HEIGHT]])
      .extent([[0, 0], [WIDTH, HEIGHT]])
      .on('zoom', (event) => setTransform(event.transform))

    const svg = select(svgRef.current)
    svg.call(zoomBehavior)
    return () => {
      svg.on('.zoom', null)
    }
  }, [])

  function changeZoom(multiplier: number) {
    if (!svgRef.current) return
    const svg = select(svgRef.current)
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, MAX_ZOOM])
      .translateExtent([[0, 0], [WIDTH, HEIGHT]])
      .extent([[0, 0], [WIDTH, HEIGHT]])
      .on('zoom', (event) => setTransform(event.transform))
    svg.transition().duration(180).call(zoomBehavior.scaleBy, multiplier)
  }

  function resetZoom() {
    if (!svgRef.current) return
    const svg = select(svgRef.current)
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, MAX_ZOOM])
      .on('zoom', (event) => setTransform(event.transform))
    svg.transition().duration(220).call(zoomBehavior.transform, zoomIdentity)
  }

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden border-y border-emerald-900/50 bg-[radial-gradient(circle_at_50%_35%,rgba(207,250,225,0.94),rgba(226,245,235,0.78)_42%,rgba(184,219,201,0.72)_100%)] sm:rounded-md sm:border">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="block h-[58vh] min-h-[360px] w-full cursor-grab touch-none active:cursor-grabbing sm:h-auto sm:aspect-[1.92/1]"
          role="img"
          aria-label="Mapa świata przedstawiająca liczbę meczów reprezentacji Polski z poszczególnymi krajami"
        >
          <defs>
            <linearGradient id={POLAND_FILL_ID} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="50%" stopColor="#ffffff" />
              <stop offset="50%" stopColor="#dc143c" />
              <stop offset="100%" stopColor="#dc143c" />
            </linearGradient>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="transparent" />
          <g transform={transform.toString()}>
            {orderedFeatures.map((mapFeature) => {
              const fifaCode = mapFeature.fifaCode
              const statistic = fifaCode ? statisticByFifaCode.get(fifaCode) : undefined
              const isHovered = Boolean(fifaCode && fifaCode === hoveredCode)
              const pathData = path(mapFeature.geometry)
              if (!pathData) return null

              return (
                <path
                  key={mapFeature.key}
                  data-fifa-code={fifaCode ?? undefined}
                  d={pathData}
                  fill={fifaCode === 'POL'
                    ? `url(#${POLAND_FILL_ID})`
                    : getFill(statistic?.matches ?? 0, maxMatches)}
                  stroke={isHovered ? '#052e1b' : '#64756c'}
                  strokeWidth={isHovered ? 1.6 / transform.k : 0.55 / transform.k}
                  vectorEffect="non-scaling-stroke"
                  className={statistic ? 'cursor-pointer transition-[filter] duration-150 ease-out' : ''}
                  style={{
                    filter: isHovered
                      ? 'drop-shadow(0 6px 6px rgba(0,0,0,0.34)) drop-shadow(0 2px 2px rgba(0,0,0,0.24)) brightness(1.06)'
                      : undefined,
                  }}
                  tabIndex={statistic ? 0 : undefined}
                  role={statistic ? 'link' : undefined}
                  aria-label={statistic
                    ? `${statistic.countryName}: ${statistic.matches} ${getMatchCountLabel(statistic.matches)}. Przejdź do strony kraju.`
                    : undefined}
                  onPointerEnter={(event) => {
                    if (!statistic || !fifaCode) return
                    setHoveredCode(fifaCode)
                    setTooltip({ x: event.clientX, y: event.clientY, statistic })
                  }}
                  onPointerMove={(event) => {
                    if (!statistic) return
                    setTooltip({ x: event.clientX, y: event.clientY, statistic })
                  }}
                  onPointerLeave={() => {
                    setHoveredCode(null)
                    setTooltip(null)
                  }}
                  onClick={() => statistic && router.push(`/countries/${statistic.countryId}`)}
                  onKeyDown={(event) => {
                    if (statistic && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault()
                      router.push(`/countries/${statistic.countryId}`)
                    }
                  }}
                />
              )
            })}
          </g>
        </svg>

        <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-md border border-emerald-950/25 bg-white/90 shadow-md backdrop-blur">
          <button type="button" onClick={() => changeZoom(1.45)} className="h-9 w-9 border-b border-emerald-950/15 text-xl font-semibold text-emerald-950 hover:bg-emerald-50" aria-label="Powiększ mapę" title="Powiększ">+</button>
          <button type="button" onClick={() => changeZoom(1 / 1.45)} className="h-9 w-9 border-b border-emerald-950/15 text-xl font-semibold text-emerald-950 hover:bg-emerald-50" aria-label="Pomniejsz mapę" title="Pomniejsz">−</button>
          <button type="button" onClick={resetZoom} className="h-9 w-9 text-lg text-emerald-950 hover:bg-emerald-50" aria-label="Resetuj widok mapy" title="Resetuj widok">↺</button>
        </div>
      </div>

      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 min-w-36 rounded-md border border-emerald-700/40 bg-emerald-950 px-3 py-2 text-sm text-emerald-50 shadow-xl"
          style={{ left: Math.min(tooltip.x + 14, window.innerWidth - 190), top: Math.max(12, tooltip.y - 62) }}
        >
          <div className="font-semibold">{tooltip.statistic.countryName}</div>
          <div className="text-emerald-200">{tooltip.statistic.matches} {getMatchCountLabel(tooltip.statistic.matches)}</div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
        <span className="mr-1 font-semibold">Liczba meczów</span>
        {[0, 0.15, 0.35, 0.6, 1].map((value, index) => (
          <span key={value} className="inline-flex items-center gap-1.5">
            <span className="h-3.5 w-7 border border-neutral-400" style={{ background: getFill(value * maxMatches, maxMatches) }} />
            <span>{index === 0 ? '0' : index === 4 ? maxMatches : `≈ ${Math.max(1, Math.round(value * maxMatches))}`}</span>
          </span>
        ))}
      </div>

      {historicalStatistics.length > 0 && (
        <section className="border-t border-neutral-300 pt-5 dark:border-neutral-700">
          <h2 className="font-barlow text-xl font-semibold text-neutral-950 dark:text-neutral-100">Mecze z reprezentacjami historycznymi</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {historicalStatistics.map((statistic) => (
              <button
                key={statistic.countryId}
                type="button"
                onClick={() => router.push(`/countries/${statistic.countryId}`)}
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-left text-sm text-neutral-800 shadow-sm hover:border-emerald-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              >
                <span className="font-semibold">{statistic.countryName}</span>
                <span className="ml-2 text-neutral-500 dark:text-neutral-400">{statistic.matches}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}