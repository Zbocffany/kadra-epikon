'use server'

import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function createClub(formData: FormData): Promise<void> {
  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const club_city_id = (formData.get('club_city_id') as string | null) || null

  if (!name) {
    redirect('/admin/clubs?error=' + encodeURIComponent('Nazwa klubu jest wymagana.'))
  }

  const supabase = createServiceRoleClient()

  const { error } = await supabase.from('tbl_Clubs').insert({
    id: crypto.randomUUID(),
    name,
    club_city_id,
  })

  if (error) {
    if (error.code === '23505') {
      redirect('/admin/clubs?error=' + encodeURIComponent(`Klub o nazwie „${name}" już istnieje.`))
    }
    redirect('/admin/clubs?error=' + encodeURIComponent(`Błąd bazy danych: ${error.message}`))
  }

  redirect('/admin/clubs?added=' + encodeURIComponent(name))
}

export async function updateClub(formData: FormData): Promise<void> {
  const id = (formData.get('id') as string | null)?.trim() ?? ''
  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const club_city_id = (formData.get('club_city_id') as string | null)?.trim() || null

  if (!id) {
    redirect('/admin/clubs?error=' + encodeURIComponent('Brak ID klubu do edycji.'))
  }

  if (!name) {
    redirect(`/admin/clubs/${id}?error=` + encodeURIComponent('Nazwa klubu jest wymagana.'))
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
      redirect(
        `/admin/clubs/${id}?error=` +
          encodeURIComponent('Klub o tej nazwie juz istnieje.')
      )
    }
    redirect(
      `/admin/clubs/${id}?error=` +
        encodeURIComponent(`Blad bazy danych: ${error.message}`)
    )
  }

  redirect(`/admin/clubs/${id}?saved=1`)
}

export async function deleteClub(formData: FormData): Promise<void> {
  const id = (formData.get('id') as string | null)?.trim() ?? ''

  if (!id) {
    redirect('/admin/clubs?error=' + encodeURIComponent('Brak ID klubu do usuniecia.'))
  }

  const supabase = createServiceRoleClient()

  const { data: club } = await supabase
    .from('tbl_Clubs')
    .select('name')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase.from('tbl_Clubs').delete().eq('id', id)

  if (error) {
    redirect(
      `/admin/clubs/${id}?error=` +
        encodeURIComponent(
          `Nie mozna usunac klubu (prawdopodobnie jest uzywany): ${error.message}`
        )
    )
  }

  redirect('/admin/clubs?added=' + encodeURIComponent(`Usunieto klub: ${club?.name ?? id}`))
}
