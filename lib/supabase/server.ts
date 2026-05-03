import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Singleton: reuse one HTTPS connection pool across all server-side DB calls.
// Safe because the service-role client is stateless (no user session).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _instance: SupabaseClient<any, 'public', any> | null = null

/**
 * Returns a shared Supabase service-role client.
 * For use in Server Components and server-side logic only.
 * Never expose the service-role key to the browser.
 */
export function createServiceRoleClient() {
  if (_instance) return _instance

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  _instance = createClient(url, key, {
    auth: {
      // No session persistence needed for server-side service-role usage
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return _instance
}
