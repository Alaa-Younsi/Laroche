-- Algeria's territorial reorganization (law n°26-06, April 2026) split 11
-- new wilayas (numbers 59-69) out of existing ones, bringing the total from
-- 58 to 69. Seed them with a default price close to their parent wilaya's;
-- admin adjusts real per-wilaya prices from DeliveryPrices.tsx before go-live.

insert into delivery_prices (wilaya, home_price, office_price, active) values
  ('Aflou', 850, 650, true),               -- ex El Bayadh
  ('Barika', 700, 500, true),               -- ex Batna
  ('El Kantara', 750, 550, true),           -- ex Biskra
  ('Bir El Ater', 750, 550, true),          -- ex Tébessa
  ('El Aricha', 700, 500, true),            -- ex Tlemcen
  ('Ksar Chellala', 650, 450, true),        -- ex Tiaret
  ('Aïn Oussara', 700, 500, true),          -- ex M'Sila
  ('Messaad', 700, 500, true),              -- ex M'Sila
  ('Ksar El Boukhari', 550, 350, true),     -- ex Médéa
  ('Bou Saâda', 700, 500, true),            -- ex M'Sila
  ('El Abiodh Sidi Cheikh', 700, 500, true); -- ex Saïda
