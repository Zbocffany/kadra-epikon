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
