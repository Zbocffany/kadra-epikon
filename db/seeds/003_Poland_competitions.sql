-- Seed: competitions (Poland NT scope)

INSERT INTO public."tbl_Competitions" (id, name)
VALUES
  (gen_random_uuid(), 'El. MŚ'),
  (gen_random_uuid(), 'Baraż MŚ'),
  (gen_random_uuid(), 'MŚ'),
  (gen_random_uuid(), 'El. ME'),
  (gen_random_uuid(), 'Baraż ME'),
  (gen_random_uuid(), 'ME'),
  (gen_random_uuid(), 'LN'),
  (gen_random_uuid(), 'Towarzyski'),
  (gen_random_uuid(), 'Nieoficjalny')
ON CONFLICT (name) DO NOTHING;
