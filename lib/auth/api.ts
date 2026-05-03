import { createServerAuthClient } from '@/lib/supabase/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * Lightweight session check for API route handlers.
 * Unlike requireAdminAccess() (which uses redirect()), this returns null on failure
 * so the route can return a proper JSON 401 response.
 */
export async function checkAdminApi(): Promise<{ userId: string } | null> {
  const authClient = await createServerAuthClient()
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()

  if (authError || !user) return null

  const supabase = createServiceRoleClient()
  const { data: roleRow } = await supabase
    .from('tbl_User_Roles')
    .select('role, is_active')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!roleRow?.is_active) return null
  return { userId: user.id }
}
