'use server'

import { redirect } from 'next/navigation'
import { createServerAuthClient } from '@/lib/supabase/auth'

export async function signInAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    redirect('/login?error=missing_credentials')
  }

  const authClient = await createServerAuthClient()
  const { error } = await authClient.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    redirect('/login?error=invalid_credentials')
  }

  redirect('/admin/matches')
}

export async function signOutAction() {
  const authClient = await createServerAuthClient()
  await authClient.auth.signOut()
  redirect('/login')
}
