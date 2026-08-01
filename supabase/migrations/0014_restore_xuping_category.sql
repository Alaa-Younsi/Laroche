-- Restore the "Bijoux en Plaqué (XUPING)" top-level category group and its 8
-- sub-categories, accidentally deleted from the live DB (the parent_id FK is
-- `on delete cascade`, so removing the parent also removed every child).
--
-- This re-creates exactly what 0011_category_plaque_xuping.sql seeded. It is
-- idempotent: if the group already exists (e.g. this migration is re-run, or a
-- partial row survived) nothing is duplicated, thanks to `on conflict (slug)`
-- and re-reading the parent id.

do $$
declare
  v_parent_id uuid;
begin
  -- parent group (sort_order 5, after Personnalisation)
  insert into categories (slug, name_fr, name_ar, sort_order)
  values ('bijoux-plaque-xuping', 'Bijoux en Plaqué (XUPING)', 'مجوهرات مطلية XUPING', 5)
  on conflict (slug) do update set sort_order = excluded.sort_order
  returning id into v_parent_id;

  -- 8 leaf sub-categories
  insert into categories (slug, name_fr, name_ar, parent_id, sort_order)
  values
    ('parures-plaque',    'Parures',              'أطقم',   v_parent_id, 1),
    ('bagues-plaque',     'Bagues',               'خواتم',  v_parent_id, 2),
    ('colliers-plaque',   'Colliers',             'قلادات', v_parent_id, 3),
    ('bracelets-plaque',  'Bracelets',            'أساور',  v_parent_id, 4),
    ('gourmettes-plaque', 'Gourmettes',           'غورميت', v_parent_id, 5),
    ('boucles-plaque',    'Boucles d''oreilles',  'أقراط',  v_parent_id, 6),
    ('pendentifs-plaque', 'Pendentifs',           'دلايات', v_parent_id, 7),
    ('chaines-plaque',    'Chaînes',              'سلاسل',  v_parent_id, 8)
  on conflict (slug) do update set parent_id = excluded.parent_id;
end $$;
