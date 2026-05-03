import { createClient, SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _cachedClient: SupabaseClient<any, 'public', any> | null = null

/**
 * Returns or creates the shared Supabase service-role client.
 * Singleton pattern: reuses one instance to share the underlying fetch connection pool.
 * For use in Server Components and server-side logic only.
 * Never expose the service-role key to the browser.
 */
export function createServiceRoleClient() {
  if (_cachedClient) return _cachedClient

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  _cachedClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return _cachedClient
}
