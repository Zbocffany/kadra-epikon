// scripts/diagnose-poland-voivodeship-stats.mjs
// Odpala oba RPC + zapytania diagnostyczne, żeby zrozumieć dlaczego statystyki = 0.
// Uruchomienie: node scripts/diagnose-poland-voivodeship-stats.mjs

import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// Wczytaj .env.local prostym parserem (unikamy zależności).
const env = {}
if (fs.existsSync('.env.local')) {
  const raw = fs.readFileSync('.env.local', 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!match) continue
    let value = match[2]
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    env[match[1]] = value
  }
}

const url = env.SUPABASE_URL ?? process.env.SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

async function main() {
  console.log('=== 1) RPC voivodeship_statistics ===')
  {
    const { data, error } = await supabase.rpc('get_poland_voivodeship_statistics')
    if (error) {
      console.error('ERROR:', error)
    } else {
      console.log('rows:', data?.length ?? 0)
      console.table(data ?? [])
    }
  }

  console.log('\n=== 2) RPC players_born_abroad (5 pierwszych) ===')
  {
    const { data, error } = await supabase.rpc('get_poland_players_born_abroad')
    if (error) {
      console.error('ERROR:', error)
    } else {
      console.log('rows:', data?.length ?? 0)
      console.table((data ?? []).slice(0, 5))
    }
  }

  console.log('\n=== 3) Polska w tbl_Countries ===')
  {
    const { data, error } = await supabase
      .from('tbl_Countries')
      .select('id, name, fifa_code')
      .or('fifa_code.eq.POL,name.ilike.polska')
    if (error) console.error(error)
    else console.table(data)
  }

  console.log('\n=== 4) Zespół reprezentacji Polski w tbl_Teams ===')
  {
    const { data: countries, error: e1 } = await supabase
      .from('tbl_Countries')
      .select('id, name, fifa_code')
      .or('fifa_code.eq.POL,name.ilike.polska')
    if (e1) throw e1
    const polandCountryId = countries?.[0]?.id
    console.log('polandCountryId:', polandCountryId)
    const { data, error } = await supabase
      .from('tbl_Teams')
      .select('id, country_id, club_id')
      .eq('country_id', polandCountryId)
      .is('club_id', null)
    if (error) console.error(error)
    else console.table(data)
    return polandCountryId
  }
}

async function main2(polandCountryId) {
  console.log('\n=== 5) Ile meczów spełnia eligible? ===')
  {
    // Team reprezentacji
    const { data: teams } = await supabase
      .from('tbl_Teams')
      .select('id')
      .eq('country_id', polandCountryId)
      .is('club_id', null)
    const teamIds = (teams ?? []).map((t) => t.id)
    console.log('teamIds:', teamIds)
    const { count } = await supabase
      .from('tbl_Matches')
      .select('id', { count: 'exact', head: true })
      .eq('editorial_status', 'VERIFIED')
      .eq('match_status', 'FINISHED')
      .neq('result_type', 'WALKOVER')
      .or(`home_team_id.in.(${teamIds.join(',')}),away_team_id.in.(${teamIds.join(',')})`)
    console.log('eligible matches count:', count)
  }

  console.log('\n=== 6) Ile Match_Participants (PLAYER, is_starting=true) dla POL ===')
  {
    const { data: teams } = await supabase
      .from('tbl_Teams')
      .select('id')
      .eq('country_id', polandCountryId)
      .is('club_id', null)
    const teamIds = (teams ?? []).map((t) => t.id)
    const { count } = await supabase
      .from('tbl_Match_Participants')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'PLAYER')
      .eq('is_starting', true)
      .in('team_id', teamIds)
    console.log('is_starting=true participants:', count)

    const { count: cAny } = await supabase
      .from('tbl_Match_Participants')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'PLAYER')
      .in('team_id', teamIds)
    console.log('all PLAYER participants (POL):', cAny)
  }

  console.log('\n=== 7) Pierwszych 5 osób z birth_city_id + voivodeship ===')
  {
    const { data } = await supabase
      .from('tbl_People')
      .select('id, first_name, last_name, birth_city_id, birth_country_id')
      .not('birth_city_id', 'is', null)
      .limit(5)
    console.table(data)
    const cityIds = (data ?? []).map((p) => p.birth_city_id).filter(Boolean)
    if (cityIds.length) {
      const { data: cities } = await supabase
        .from('tbl_Cities')
        .select('id, city_name, voivodeship, current_country_id')
        .in('id', cityIds)
      console.table(cities)
    }
  }
}

const polandId = await main()
if (polandId) await main2(polandId)
