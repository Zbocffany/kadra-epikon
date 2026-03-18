'use server'

import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase/server'

function normalizeFifaCode(raw: FormDataEntryValue | null): string | null {
  const val = (typeof raw === 'string' ? raw : '').trim().toUpperCase()
  return val ? val : null
}

export async function createCountry(formData: FormData): Promise<void> {
  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const fifaCode = normalizeFifaCode(formData.get('fifa_code'))
  const federationId = (formData.get('federation_id') as string | null)?.trim() || null

  if (!name) {
    redirect('/admin/countries?error=' + encodeURIComponent('Nazwa kraju jest wymagana.'))
  }

  if (fifaCode && !/^[A-Z]{3}$/.test(fifaCode)) {
    redirect('/admin/countries?error=' + encodeURIComponent('Kod FIFA musi miec 3 wielkie litery, np. POL.'))
  }

  const supabase = createServiceRoleClient()

  const { error } = await supabase.from('tbl_Countries').insert({
    id: crypto.randomUUID(),
    name,
    fifa_code: fifaCode,
    federation_id: federationId,
  })

  if (error) {
    if (error.code === '23505') {
      if (error.message.includes('fifa_code')) {
        redirect('/admin/countries?error=' + encodeURIComponent(`Kod FIFA ${fifaCode} juz istnieje.`))
      }
      redirect('/admin/countries?error=' + encodeURIComponent('Rekord z taka wartoscia juz istnieje.'))
    }

    redirect('/admin/countries?error=' + encodeURIComponent(`Blad bazy danych: ${error.message}`))
  }

  redirect('/admin/countries?added=' + encodeURIComponent(name))
}

export async function updateCountry(formData: FormData): Promise<void> {
  const id = (formData.get('id') as string | null)?.trim() ?? ''
  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const fifaCode = normalizeFifaCode(formData.get('fifa_code'))
  const federationId = (formData.get('federation_id') as string | null)?.trim() || null

  if (!id) {
    redirect('/admin/countries?error=' + encodeURIComponent('Brak ID kraju do edycji.'))
  }

  if (!name) {
    redirect(`/admin/countries/${id}?error=` + encodeURIComponent('Nazwa kraju jest wymagana.'))
  }

  if (fifaCode && !/^[A-Z]{3}$/.test(fifaCode)) {
    redirect(
      `/admin/countries/${id}?error=` +
        encodeURIComponent('Kod FIFA musi miec 3 wielkie litery, np. POL.')
    )
  }

  const supabase = createServiceRoleClient()

  const { error } = await supabase
    .from('tbl_Countries')
    .update({
      name,
      fifa_code: fifaCode,
      federation_id: federationId,
    })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      redirect(
        `/admin/countries/${id}?error=` +
          encodeURIComponent('Rekord z taka wartoscia juz istnieje.')
      )
    }

    redirect(
      `/admin/countries/${id}?error=` +
        encodeURIComponent(`Blad bazy danych: ${error.message}`)
    )
  }

  redirect(`/admin/countries/${id}?saved=1`)
}

export async function deleteCountry(formData: FormData): Promise<void> {
  const id = (formData.get('id') as string | null)?.trim() ?? ''

  if (!id) {
    redirect('/admin/countries?error=' + encodeURIComponent('Brak ID kraju do usuniecia.'))
  }

  const supabase = createServiceRoleClient()

  const { data: country } = await supabase
    .from('tbl_Countries')
    .select('name')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase.from('tbl_Countries').delete().eq('id', id)

  if (error) {
    redirect(
      `/admin/countries/${id}?error=` +
        encodeURIComponent(
          `Nie mozna usunac kraju (prawdopodobnie jest uzywany): ${error.message}`
        )
    )
  }

  redirect(
    '/admin/countries?added=' +
      encodeURIComponent(`Usunieto kraj: ${country?.name ?? id}`)
  )
}
