export const VOIVODESHIP_OPTIONS = [
  { value: 'Dolnośląskie', label: 'Dolnośląskie' },
  { value: 'Kujawsko-pomorskie', label: 'Kujawsko-pomorskie' },
  { value: 'Lubelskie', label: 'Lubelskie' },
  { value: 'Lubuskie', label: 'Lubuskie' },
  { value: 'Łódzkie', label: 'Łódzkie' },
  { value: 'Małopolskie', label: 'Małopolskie' },
  { value: 'Mazowieckie', label: 'Mazowieckie' },
  { value: 'Opolskie', label: 'Opolskie' },
  { value: 'Podkarpackie', label: 'Podkarpackie' },
  { value: 'Podlaskie', label: 'Podlaskie' },
  { value: 'Pomorskie', label: 'Pomorskie' },
  { value: 'Śląskie', label: 'Śląskie' },
  { value: 'Świętokrzyskie', label: 'Świętokrzyskie' },
  { value: 'Warmińsko-mazurskie', label: 'Warmińsko-mazurskie' },
  { value: 'Wielkopolskie', label: 'Wielkopolskie' },
  { value: 'Zachodniopomorskie', label: 'Zachodniopomorskie' },
] as const

export type VoivodeshipValue = typeof VOIVODESHIP_OPTIONS[number]['value']
