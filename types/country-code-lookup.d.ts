declare module 'country-code-lookup' {
  export type CountryCodeRecord = {
    country: string
    iso2: string
    iso3: string
    isoNo: string
  }

  const lookup: {
    byIso(code: string | number): CountryCodeRecord | null
  }

  export default lookup
}