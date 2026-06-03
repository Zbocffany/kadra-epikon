import { createClient } from '@supabase/supabase-js'

function parseArgs(argv) {
  const args = { limit: 5, offset: 0 }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--limit') {
      args.limit = Number.parseInt(argv[i + 1] ?? '5', 10) || 5
      i += 1
    } else if (arg === '--offset') {
      args.offset = Number.parseInt(argv[i + 1] ?? '0', 10) || 0
      i += 1
    }
  }
  return args
}

const { limit, offset } = parseArgs(process.argv.slice(2))

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

const { data: clubs, error: clubsError } = await supabase
  .from('tbl_Clubs')
  .select('id,name')
  .not('name', 'is', null)
  .order('name', { ascending: true })

if (clubsError) {
  throw new Error(`Load clubs: ${clubsError.message}`)
}

const clubIds = clubs.map((club) => club.id)
const foundedSet = new Set()
const CHUNK_SIZE = 200

for (let i = 0; i < clubIds.length; i += CHUNK_SIZE) {
  const idsChunk = clubIds.slice(i, i + CHUNK_SIZE)
  const { data: foundedRows, error: foundedError } = await supabase
    .from('tbl_Club_History')
    .select('club_id')
    .in('club_id', idsChunk)
    .eq('event_type', 'FOUNDED')

  if (foundedError) {
    throw new Error(`Load founded history: ${foundedError.message}`)
  }

  for (const row of foundedRows) {
    foundedSet.add(row.club_id)
  }
}

const missing = clubs.filter((club) => !foundedSet.has(club.id))
const batch = missing.slice(offset, offset + limit)

console.log(`Missing total: ${missing.length}`)
console.log(`Batch offset=${offset}, limit=${limit}, size=${batch.length}`)
for (const club of batch) {
  console.log(`${club.name}|${club.id}`)
}
