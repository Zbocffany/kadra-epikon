import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createServerAuthClient } from '@/lib/supabase/auth'

export type AppUserRole = 'ADMIN' | 'EDITOR'

type AccessContext = {
  authUserId: string
  role: AppUserRole
}

/**
 * Resolves current user session (Supabase Auth cookie) and app role.
 * Redirects to home when access is missing.
 */
export async function requireAdminAccess(
  allowedRoles: AppUserRole[] = ['ADMIN', 'EDITOR']
): Promise<AccessContext> {
  const authClient = await createServerAuthClient()
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  const serviceRoleClient = createServiceRoleClient()
  const { data: roleRow, error: roleError } = await serviceRoleClient
    .from('tbl_User_Roles')
    .select('role, is_active')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (
    roleError ||
    !roleRow ||
    !roleRow.is_active ||
    !allowedRoles.includes(roleRow.role as AppUserRole)
  ) {
    redirect('/login')
  }

  return {
    authUserId: user.id,
    role: roleRow.role as AppUserRole,
  }
}
