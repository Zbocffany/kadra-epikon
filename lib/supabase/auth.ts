import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Cookie-based Supabase Auth client for Server Components / Server Actions.
 * Uses anon key and current request cookies to resolve signed-in user session.
 */
export async function createServerAuthClient() {
  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Missing required env vars: SUPABASE_URL and SUPABASE_ANON_KEY'
    )
  }

  const cookieStore = await cookies()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        // setAll may be called in contexts where mutating cookies is not allowed.
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Ignore in read-only render contexts.
        }
      },
    },
  })
}
