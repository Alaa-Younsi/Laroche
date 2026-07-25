-- Adds a fourth top-level category group for gold-plated costume jewelry
-- (XUPING), alongside the existing Argent 925 / Acier Inoxydable / Montres /
-- Personnalisation groups from 0006_seed_catalogue.sql. Same sub-category
-- shape as Bijoux en Argent 925 since it covers the same product types.

with parent as (
  insert into categories (slug, name_fr, name_ar, sort_order)
  values ('bijoux-plaque-xuping', 'Bijoux en Plaqué (XUPING)', 'مجوهرات مطلية XUPING', 5)
  returning id
)
insert into categories (slug, name_fr, name_ar, parent_id, sort_order)
select slug, name_fr, name_ar, parent.id, sort_order
from parent, (values
  ('parures-plaque', 'Parures', 'أطقم', 1),
  ('bagues-plaque', 'Bagues', 'خواتم', 2),
  ('colliers-plaque', 'Colliers', 'قلادات', 3),
  ('bracelets-plaque', 'Bracelets', 'أساور', 4),
  ('gourmettes-plaque', 'Gourmettes', 'غورميت', 5),
  ('boucles-plaque', 'Boucles d''oreilles', 'أقراط', 6),
  ('pendentifs-plaque', 'Pendentifs', 'دلايات', 7),
  ('chaines-plaque', 'Chaînes', 'سلاسل', 8)
) as sub (slug, name_fr, name_ar, sort_order);
