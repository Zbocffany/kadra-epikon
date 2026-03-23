import AdminSelectField from '@/components/admin/AdminSelectField'
import { createCityInline } from '@/app/admin/cities/actions'
import { createCountryInline } from '@/app/admin/countries/actions'
import { VOIVODESHIP_OPTIONS } from '@/lib/constants/voivodeships'
import type { AdminCountryOption } from '@/lib/db/cities'
import type { AdminFederation } from '@/lib/db/countries'

type InlineOption = {
  id: string
  label: string
}

type InlineCreatedOption = {
  id: string
  label?: string
}

type CreateCityInlineFormProps = {
  scope: string
  countries: AdminCountryOption[]
  federations: AdminFederation[]
  onCountryOptionCreated?: (option: InlineCreatedOption) => void
}

export function renderCreateCityInlineForm({
  scope,
  countries,
  federations,
  onCountryOptionCreated,
}: CreateCityInlineFormProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${scope}_city_name`} className="text-xs text-neutral-400">
          Nazwa miasta
        </label>
        <input
          id={`${scope}_city_name`}
          name="city_name"
          type="text"
          required
          className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
        />
      </div>

      <AdminSelectField
        name="country_id"
        label="Kraj"
        required
        options={countries.map((country) => ({ id: country.id, label: country.name }))}
        displayKey="label"
        placeholder="Wpisz, aby filtrować kraje..."
        addButtonLabel="+ Dodaj kraj"
        addDialogTitle="Nowy kraj"
        emptyResultsMessage="Brak wyników - możesz dodać nowy kraj poniżej."
        createAction={createCountryInline}
        onOptionCreated={onCountryOptionCreated}
        inlineForm={(
          <div className="space-y-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${scope}_city_country_name`} className="text-xs text-neutral-400">
                Nazwa kraju
              </label>
              <input
                id={`${scope}_city_country_name`}
                name="name"
                type="text"
                required
                className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${scope}_city_country_fifa`} className="text-xs text-neutral-400">
                Kod FIFA
              </label>
              <input
                id={`${scope}_city_country_fifa`}
                name="fifa_code"
                type="text"
                maxLength={3}
                className="uppercase rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${scope}_city_country_federation`} className="text-xs text-neutral-400">
                Federacja
              </label>
              <select
                id={`${scope}_city_country_federation`}
                name="federation_id"
                className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
              >
                <option value="">— brak —</option>
                {federations.map((federation) => (
                  <option key={federation.id} value={federation.id}>
                    {federation.short_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${scope}_city_voivodeship`} className="text-xs text-neutral-400">
          Województwo (tylko Polska)
        </label>
        <select
          id={`${scope}_city_voivodeship`}
          name="voivodeship"
          className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
        >
          <option value="">- brak -</option>
          {VOIVODESHIP_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

type CreateClubInlineFormProps = {
  scope: string
  cityOptions: InlineOption[]
  countries: AdminCountryOption[]
  federations: AdminFederation[]
  onCityOptionCreated?: (option: InlineCreatedOption) => void
  onCountryOptionCreated?: (option: InlineCreatedOption) => void
}

export function renderCreateClubInlineForm({
  scope,
  cityOptions,
  countries,
  federations,
  onCityOptionCreated,
  onCountryOptionCreated,
}: CreateClubInlineFormProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${scope}_club_name`} className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Nazwa klubu
        </label>
        <input
          id={`${scope}_club_name`}
          name="name"
          type="text"
          required
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
        />
      </div>

      <AdminSelectField
        name="club_city_id"
        label="Miasto klubu (opcjonalnie)"
        required={false}
        emptyOptionLabel="— brak —"
        options={cityOptions}
        displayKey="label"
        placeholder="Wpisz, aby filtrować miasta..."
        addButtonLabel="+ Dodaj miasto"
        addDialogTitle="Nowe miasto"
        emptyResultsMessage="Brak wyników - możesz dodać nowe miasto poniżej."
        createAction={createCityInline}
        onOptionCreated={onCityOptionCreated}
        inlineForm={renderCreateCityInlineForm({
          scope: `${scope}_club`,
          countries,
          federations,
          onCountryOptionCreated,
        })}
      />
    </div>
  )
}

type CreateStadiumInlineFormProps = {
  scope: string
  cityOptions: InlineOption[]
  countries: AdminCountryOption[]
  federations: AdminFederation[]
  onSelectedCityIdChange?: (cityId: string) => void
  onCityOptionCreated?: (option: InlineCreatedOption) => void
  onCountryOptionCreated?: (option: InlineCreatedOption) => void
}

export function renderCreateStadiumInlineForm({
  scope,
  cityOptions,
  countries,
  federations,
  onSelectedCityIdChange,
  onCityOptionCreated,
  onCountryOptionCreated,
}: CreateStadiumInlineFormProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${scope}_stadium_name`} className="text-xs text-neutral-400">
          Nazwa stadionu
        </label>
        <input
          id={`${scope}_stadium_name`}
          name="name"
          type="text"
          required
          className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
        />
      </div>

      <AdminSelectField
        name="stadium_city_id"
        label="Miasto"
        required
        options={cityOptions}
        displayKey="label"
        placeholder="Wpisz, aby filtrować miasta..."
        addButtonLabel="Dodaj miasto"
        addDialogTitle="Nowe miasto"
        emptyResultsMessage="Brak wyników - możesz dodać nowe miasto poniżej."
        createAction={createCityInline}
        onSelectedIdChange={onSelectedCityIdChange}
        onOptionCreated={onCityOptionCreated}
        inlineForm={renderCreateCityInlineForm({
          scope: `${scope}_stadium`,
          countries,
          federations,
          onCountryOptionCreated,
        })}
      />
    </div>
  )
}
