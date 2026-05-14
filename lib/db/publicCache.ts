import { createServiceRoleClient } from '@/lib/supabase/server'

const PUBLIC_CACHE_KEY = 'global'
const VERSION_TTL_MS = 1_000 // 1s lokalnego cache wersji — kompromis między ruchem do bazy a świeżością.

type VersionState = {
  value: number
  expiresAt: number
  inFlight?: Promise<number>
}

// Stan lokalny per-proces (na serwerze Next). Bardzo tanie odczyty — bez I/O w gorącej ścieżce.
const state: VersionState = {
  value: 1,
  expiresAt: 0,
}

let warnedMissingTable = false

async function fetchVersionFromDb(): Promise<number> {
  try {
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from('tbl_Public_Cache_Version')
      .select('version')
      .eq('cache_key', PUBLIC_CACHE_KEY)
      .maybeSingle()

    if (error) {
      // Tabela nie istnieje (np. migracja jeszcze nie zastosowana) — degradujemy łagodnie.
      if (!warnedMissingTable) {
        warnedMissingTable = true
        console.warn(
          `[publicCache] Nie udało się pobrać wersji cache (${error.message}). ` +
            `Używam fallback=1. Zastosuj migrację 013_public_cache_versioning.sql aby włączyć auto-invalidation.`
        )
      }
      return state.value || 1
    }

    if (!data) {
      const { error: insertError } = await supabase
        .from('tbl_Public_Cache_Version')
        .insert({ cache_key: PUBLIC_CACHE_KEY, version: 1 })
      if (insertError) {
        console.warn(`[publicCache] Init wersji nie powiódł się: ${insertError.message}`)
      }
      return 1
    }

    return Number(data.version ?? 1)
  } catch (e) {
    if (!warnedMissingTable) {
      warnedMissingTable = true
      console.warn(`[publicCache] Wyjątek przy pobieraniu wersji: ${(e as Error).message}`)
    }
    return state.value || 1
  }
}

export async function getPublicCacheVersion(): Promise<number> {
  const now = Date.now()

  // Świeży cache — zwracamy natychmiast, bez I/O.
  if (now < state.expiresAt) {
    return state.value
  }

  // Deduplikacja równoległych requestów — jeden lot do DB na raz.
  if (state.inFlight) {
    return state.inFlight
  }

  state.inFlight = fetchVersionFromDb()
    .then((v) => {
      state.value = v
      state.expiresAt = Date.now() + VERSION_TTL_MS
      return v
    })
    .finally(() => {
      state.inFlight = undefined
    })

  return state.inFlight
}

/**
 * Wymusza natychmiastowe odświeżenie wersji przy następnym odczycie.
 * Wołane z admin actions po mutacji, żeby nie czekać na TTL.
 * (Sama wartość w DB jest bumpowana przez triggery na tabelach źródłowych.)
 */
export function invalidatePublicCacheVersion(): void {
  state.expiresAt = 0
}

export async function getPublicCacheKey(...parts: string[]): Promise<string[]> {
  const version = await getPublicCacheVersion()
  return [...parts, `v:${version}`]
}