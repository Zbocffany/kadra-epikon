import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client using the service-role key.
 * For use in Server Components and server-side logic only.
 * Never expose the service-role key to the browser.
 */
export function createServiceRoleClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  return createClient(url, key, {
    auth: {
      // No session persistence needed for server-side service-role usage
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
