'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  getTrimmedNullable,
  getTrimmedString,
  redirectWithAdded,
  redirectWithError,
  redirectWithSaved,
} from '@/lib/actions/admin'

export async function createClub(formData: FormData): Promise<void> {
  const name = getTrimmedString(formData, 'name')
  const club_city_id = getTrimmedNullable(formData, 'club_city_id')

  if (!name) {
    redirectWithError('/admin/clubs', 'Nazwa klubu jest wymagana.')
  }

  const supabase = createServiceRoleClient()

  const { error } = await supabase.from('tbl_Clubs').insert({
    id: crypto.randomUUID(),
    name,
    club_city_id,
  })

  if (error) {
    if (error.code === '23505') {
      redirectWithError('/admin/clubs', `Klub o nazwie „${name}" już istnieje.`)
    }
    redirectWithError('/admin/clubs', `Błąd bazy danych: ${error.message}`)
  }

  redirectWithAdded('/admin/clubs', name)
}

export async function updateClub(formData: FormData): Promise<void> {
  const id = getTrimmedString(formData, 'id')
  const name = getTrimmedString(formData, 'name')
  const club_city_id = getTrimmedNullable(formData, 'club_city_id')

  if (!id) {
    redirectWithError('/admin/clubs', 'Brak ID klubu do edycji.')
  }

  if (!name) {
    redirectWithError(`/admin/clubs/${id}`, 'Nazwa klubu jest wymagana.')
  }

  const supabase = createServiceRoleClient()

  const { error } = await supabase
    .from('tbl_Clubs')
    .update({
      name,
      club_city_id,
    })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      redirectWithError(`/admin/clubs/${id}`, 'Klub o tej nazwie juz istnieje.')
    }
    redirectWithError(`/admin/clubs/${id}`, `Blad bazy danych: ${error.message}`)
  }

  redirectWithSaved(`/admin/clubs/${id}`)
}

export async function deleteClub(formData: FormData): Promise<void> {
  const id = getTrimmedString(formData, 'id')

  if (!id) {
    redirectWithError('/admin/clubs', 'Brak ID klubu do usuniecia.')
  }

  const supabase = createServiceRoleClient()

  const { data: club } = await supabase
    .from('tbl_Clubs')
    .select('name')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase.from('tbl_Clubs').delete().eq('id', id)

  if (error) {
    redirectWithError(
      `/admin/clubs/${id}`,
      `Nie mozna usunac klubu (prawdopodobnie jest uzywany): ${error.message}`
    )
  }

  redirectWithAdded('/admin/clubs', `Usunieto klub: ${club?.name ?? id}`)
}
