'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireAdminAccess } from '@/lib/auth/admin'
import { getTrimmedString, redirectWithAdded, redirectWithError } from '@/lib/actions/admin'

const ADMIN_PASSWORD = 'EpikonAdmin!'

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function findAuthUserByEmail(email: string): Promise<string | null> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })

  if (error) {
    throw new Error('Nie udało się odczytać listy użytkowników Supabase Auth.')
  }

  const normalizedEmail = email.toLowerCase()
  const existingUser = data.users.find((user) => user.email?.toLowerCase() === normalizedEmail)
  return existingUser?.id ?? null
}

export async function createAdminUser(formData: FormData): Promise<void> {
  await requireAdminAccess(['ADMIN'])

  const email = getTrimmedString(formData, 'email').toLowerCase()
  if (!email) {
    redirectWithError('/admin/admins', 'Podaj adres email.')
  }

  if (!isValidEmail(email)) {
    redirectWithError('/admin/admins', 'Podaj poprawny adres email.')
  }

  const supabase = createServiceRoleClient()

  let authUserId: string | null = null
  const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
    email,
    password: ADMIN_PASSWORD,
    email_confirm: true,
  })

  if (createdUser.user?.id) {
    authUserId = createdUser.user.id
  } else {
    const existingUserId = await findAuthUserByEmail(email)
    if (existingUserId) {
      authUserId = existingUserId
    } else {
      const message = createUserError?.message ?? 'Nie udało się utworzyć użytkownika admina.'
      redirectWithError('/admin/admins', message)
    }
  }

  const { error: roleError } = await supabase.from('tbl_User_Roles').upsert(
    {
      auth_user_id: authUserId,
      role: 'ADMIN',
      is_active: true,
    },
    { onConflict: 'auth_user_id' }
  )

  if (roleError) {
    redirectWithError('/admin/admins', 'Nie udało się przypisać roli admina.')
  }

  redirectWithAdded('/admin/admins', email)
}