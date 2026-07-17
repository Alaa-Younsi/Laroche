-- Seed category groups + subcategories, collections, and brands from the
-- client's catalogue brief (Devis INF-LB-2026-001).

with parent as (
  insert into categories (slug, name_fr, name_ar, sort_order)
  values ('bijoux-argent-925', 'Bijoux en Argent 925', 'مجوهرات فضة 925', 1)
  returning id
)
insert into categories (slug, name_fr, name_ar, parent_id, sort_order)
select slug, name_fr, name_ar, parent.id, sort_order
from parent, (values
  ('parures-argent', 'Parures', 'أطقم', 1),
  ('bagues-argent', 'Bagues', 'خواتم', 2),
  ('colliers-argent', 'Colliers', 'قلادات', 3),
  ('bracelets-argent', 'Bracelets', 'أساور', 4),
  ('gourmettes-argent', 'Gourmettes', 'غورميت', 5),
  ('boucles-argent', 'Boucles d''oreilles', 'أقراط', 6),
  ('pendentifs-argent', 'Pendentifs', 'دلايات', 7),
  ('chaines-argent', 'Chaînes', 'سلاسل', 8)
) as sub (slug, name_fr, name_ar, sort_order);

with parent as (
  insert into categories (slug, name_fr, name_ar, sort_order)
  values ('bijoux-acier-inox', 'Bijoux en Acier Inoxydable', 'مجوهرات ستانلس ستيل', 2)
  returning id
)
insert into categories (slug, name_fr, name_ar, parent_id, sort_order)
select slug, name_fr, name_ar, parent.id, sort_order
from parent, (values
  ('parures-inox', 'Parures', 'أطقم', 1),
  ('bagues-inox', 'Bagues', 'خواتم', 2),
  ('bracelets-inox', 'Bracelets', 'أساور', 3),
  ('gourmettes-inox', 'Gourmettes', 'غورميت', 4),
  ('colliers-inox', 'Colliers', 'قلادات', 5),
  ('boucles-inox', 'Boucles d''oreilles', 'أقراط', 6)
) as sub (slug, name_fr, name_ar, sort_order);

with parent as (
  insert into categories (slug, name_fr, name_ar, sort_order)
  values ('montres', 'Montres', 'ساعات', 3)
  returning id
)
insert into categories (slug, name_fr, name_ar, parent_id, sort_order)
select slug, name_fr, name_ar, parent.id, sort_order
from parent, (values
  ('montres-femme', 'Montres Femme', 'ساعات نسائية', 1),
  ('montres-homme', 'Montres Homme', 'ساعات رجالية', 2)
) as sub (slug, name_fr, name_ar, sort_order);

with parent as (
  insert into categories (slug, name_fr, name_ar, sort_order)
  values ('personnalisation', 'Personnalisation', 'تخصيص', 4)
  returning id
)
insert into categories (slug, name_fr, name_ar, parent_id, sort_order)
select slug, name_fr, name_ar, parent.id, sort_order
from parent, (values
  ('gravure-laser', 'Gravure Laser', 'نقش بالليزر', 1),
  ('bijoux-personnalises', 'Bijoux Personnalisés', 'مجوهرات مخصصة', 2)
) as sub (slug, name_fr, name_ar, sort_order);

insert into collections (slug, name_fr, name_ar, sort_order) values
  ('bijoux-homme', 'Bijoux Homme', 'مجوهرات رجالية', 1),
  ('nouveautes', 'Nouveautés', 'وصل حديثاً', 2),
  ('best-sellers', 'Best Sellers', 'الأكثر مبيعاً', 3),
  ('collection-luxe', 'Collection Luxe', 'تشكيلة فاخرة', 4),
  ('collection-mariage', 'Collection Mariage', 'تشكيلة الزفاف', 5),
  ('collection-soiree', 'Collection Soirée', 'تشكيلة السهرة', 6),
  ('cadeaux', 'Cadeaux', 'هدايا', 7),
  ('promotions', 'Promotions', 'عروض', 8),
  ('precommandes', 'Précommandes', 'طلب مسبق', 9);

insert into brands (slug, name, sort_order) values
  ('michael-kors', 'Michael Kors', 1),
  ('emporio-armani', 'Emporio Armani', 2),
  ('hugo-boss', 'Hugo Boss', 3),
  ('maserati', 'Maserati', 4),
  ('ieke', 'Ieke', 5);
