-- Seed: federacje piłkarskie (kontynentalne + FIFA)

INSERT INTO public."tbl_Federations" (
  id,
  short_name,
  full_name,
  foundation_year
)
VALUES
  (gen_random_uuid(), 'FIFA', 'Międzynarodowa Federacja Piłki Nożnej', 1904),
  (gen_random_uuid(), 'UEFA', 'Unia Europejskich Związków Piłkarskich', 1954),
  (gen_random_uuid(), 'CONMEBOL', 'Południowoamerykańska Konfederacja Piłki Nożnej', 1916),
  (gen_random_uuid(), 'CONCACAF', 'Konfederacja Piłki Nożnej Ameryki Północnej, Środkowej i Karaibów', 1961),
  (gen_random_uuid(), 'AFC', 'Azjatycka Konfederacja Piłki Nożnej', 1954),
  (gen_random_uuid(), 'CAF', 'Afrykańska Konfederacja Piłki Nożnej', 1957),
  (gen_random_uuid(), 'OFC', 'Konfederacja Piłki Nożnej Oceanii', 1966)
ON CONFLICT (short_name) DO UPDATE
SET
  full_name = EXCLUDED.full_name,
  foundation_year = EXCLUDED.foundation_year;