// One-time script: manually insert FOUNDED events for a list of clubs.
// Usage: node --env-file=.env.local scripts/_manual-insert-founded.mjs
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const FOUNDED_TITLE = 'Założenie klubu'
const YEAR_PRECISION = 'YEAR'

const clubs = [
  { name: 'Zenit', year: 1925 },
]

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

for (const { name, year } of clubs) {
  // Find club id
  const { data, error } = await supabase
    .from('tbl_Clubs')
    .select('id, name')
    .ilike('name', name)
    .limit(1)
    .single()

  if (error || !data) {
    console.log(`NOT FOUND / SKIP: ${name} (${error?.message ?? 'no row'})`)
    continue
  }

  // Check if FOUNDED already exists
  const { data: existing } = await supabase
    .from('tbl_Club_History')
    .select('id')
    .eq('club_id', data.id)
    .eq('event_type', 'FOUNDED')
    .limit(1)
    .single()

  if (existing) {
    console.log(`ALREADY EXISTS: ${name}`)
    continue
  }

  const eventDate = `${String(year).padStart(4, '0')}-01-01`
  const { error: insErr } = await supabase.from('tbl_Club_History').insert({
    id: crypto.randomUUID(),
    club_id: data.id,
    title: FOUNDED_TITLE,
    description: 'Ręczny import',
    event_type: 'FOUNDED',
    event_date: eventDate,
    event_date_precision: YEAR_PRECISION,
    event_order: 0,
  })

  if (insErr) {
    console.log(`ERROR: ${name} → ${insErr.message}`)
  } else {
    console.log(`OK: ${name} → ${year}`)
  }
}
