import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireAdminAccess } from '@/lib/auth/admin'
import AdminListLayout from '@/components/admin/AdminListLayout'
import { createAdminUser } from './actions'

type SearchParams = Promise<{ added?: string; error?: string }>

type AdminUserRow = {
  auth_user_id: string
  role: string
  is_active: boolean
  created_at: string
}

type AuthUser = {
  id: string
  email: string | null
}

function isValidBannerValue(value: string | undefined): value is string {
  return Boolean(value && value.trim())
}

export default async function AdminAdminsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdminAccess(['ADMIN'])

  const { added, error } = await searchParams

  const supabase = createServiceRoleClient()
  const [{ data: roleRows, error: roleRowsError }, { data: usersData, error: usersError }] = await Promise.all([
    supabase
      .from('tbl_User_Roles')
      .select('auth_user_id, role, is_active, created_at')
      .eq('role', 'ADMIN')
      .order('created_at', { ascending: false }),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])

  if (roleRowsError) {
    throw new Error(`tbl_User_Roles: ${roleRowsError.message}`)
  }

  if (usersError) {
    throw new Error(`auth.users: ${usersError.message}`)
  }

  const usersById = new Map((usersData.users as AuthUser[]).map((user) => [user.id, user]))
  const admins = (roleRows ?? [])
    .map((row) => {
      const user = usersById.get((row as AdminUserRow).auth_user_id)
      return {
        auth_user_id: (row as AdminUserRow).auth_user_id,
        email: user?.email ?? '—',
        is_active: (row as AdminUserRow).is_active,
        created_at: (row as AdminUserRow).created_at,
      }
    })
    .filter((row) => row.email !== '—')

  return (
    <AdminListLayout
      title="Admini"
      breadcrumb="Admin"
      recordCount={admins.length}
      recordLabel={admins.length === 1 ? 'admin' : 'adminów'}
    >
      {isValidBannerValue(added) ? (
        <div className="rounded-lg border border-emerald-800 bg-emerald-950/50 px-5 py-4 text-sm text-emerald-200">
          Dodano admina: <strong className="font-semibold text-emerald-100">{added}</strong>
        </div>
      ) : null}

      {isValidBannerValue(error) ? (
        <div className="rounded-lg border border-red-800 bg-red-950/50 px-5 py-4 text-sm text-red-300">
          <strong className="font-semibold">Błąd:</strong> {error}
        </div>
      ) : null}

      <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-6 shadow-xl">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-neutral-100">Dodaj admina</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Nowe konto zostanie utworzone z hasłem <span className="font-semibold text-neutral-200">EpikonAdmin!</span> i rolą ADMIN.
          </p>
        </div>

            <form action={createAdminUser} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-medium text-neutral-300">
                  Email
                </label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="admin@przyklad.pl"
                    className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                  />

                  <button
                    type="submit"
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-md border border-emerald-300 bg-emerald-100 px-5 text-sm font-semibold text-neutral-950 shadow-[0_4px_12px_rgba(16,185,129,0.25)] hover:bg-white"
                  >
                    Dodaj admina
                  </button>
                </div>
              </div>
            </form>
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-neutral-100">Aktualni admini</h2>

        <div className="overflow-hidden rounded-lg border border-neutral-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-900 text-neutral-400">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Aktywny</th>
                <th className="px-4 py-3 font-medium">Dodano</th>
              </tr>
            </thead>
            <tbody className="bg-neutral-950 text-neutral-200">
              {admins.length > 0 ? admins.map((admin) => (
                <tr key={admin.auth_user_id} className="border-t border-neutral-800">
                  <td className="px-4 py-3 font-medium text-neutral-100">{admin.email}</td>
                  <td className="px-4 py-3">{admin.is_active ? 'Tak' : 'Nie'}</td>
                  <td className="px-4 py-3 text-neutral-400">{new Date(admin.created_at).toLocaleString('pl-PL')}</td>
                </tr>
              )) : (
                <tr>
                  <td className="px-4 py-6 text-neutral-500" colSpan={3}>
                    Brak adminów do wyświetlenia.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminListLayout>
  )
}