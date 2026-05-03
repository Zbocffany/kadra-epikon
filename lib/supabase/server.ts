import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Agent } from 'https'

/**
 * Reuse one HTTPS Agent across all requests for connection pooling.
 * This prevents "ECONNRESET" errors when many concurrent queries hit Supabase.
 */
const httpsAgent = new Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 30000,
})

/**
 * Create a fresh Supabase service-role client for each request.
 * The shared HTTPS Agent ensures connection pooling across requests.
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

  // Create a new client for this request, but it reuses the shared HTTPS Agent
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      // @ts-ignore - fetch doesn't expose agent option directly, but supabase-js uses global fetch
      fetch: (url: string, options?: any) =>
        fetch(url, {
          ...options,
          agent: httpsAgent,
        }),
    },
  })
}
