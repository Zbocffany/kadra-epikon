import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Shared Supabase service-role client to reuse one HTTPS connection pool.
 * Safe because the service-role client is stateless (no user session).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _cachedClient: SupabaseClient<any, 'public', any> | null = null

/**
 * Returns or creates the shared Supabase service-role client.
 * Subsequent calls reuse the cached instance to share the underlying HTTPS Agent.
 * For use in Server Components and server-side logic only.
 * Never expose the service-role key to the browser.
 */
export function createServiceRoleClient() {
  // Return cached instance to reuse the underlying HTTPS Agent's connection pool
  if (_cachedClient) {
    return _cachedClient
  }

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  _cachedClient = createClient(url, key, {
    auth: {
      // No session persistence needed for server-side service-role usage
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return _cachedClient
}
