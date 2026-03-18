import { redirect } from 'next/navigation'
import { createServerAuthClient } from '@/lib/supabase/auth'
import { signInAction } from './actions'

type LoginPageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const authClient = await createServerAuthClient()
  const {
    data: { user },
  } = await authClient.auth.getUser()

  if (user) {
    redirect('/admin/matches')
  }

  const params = await searchParams
  const hasError = params.error === 'invalid_credentials' || params.error === 'missing_credentials'

  return (
    <main className="min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-md rounded-xl border border-neutral-800 bg-neutral-950 p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Admin
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Logowanie</h1>

        {hasError && (
          <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            Nieprawidlowy email lub haslo.
          </div>
        )}

        <form action={signInAction} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-neutral-300">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none ring-0 placeholder:text-neutral-500 focus:border-neutral-500"
              placeholder="name@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-neutral-300">
              Haslo
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none ring-0 placeholder:text-neutral-500 focus:border-neutral-500"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md border border-neutral-700 bg-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-white"
          >
            Zaloguj
          </button>
        </form>
      </div>
    </main>
  )
}
