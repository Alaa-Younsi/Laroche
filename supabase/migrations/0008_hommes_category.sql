-- Adds a "Hommes" sub-category under "Bijoux en Argent 925", itself holding
-- three leaf sub-categories (Colliers, Bagues, Gourmettes) — a third
-- taxonomy level. categories.parent_id is already self-referencing with no
-- depth limit (0005_taxonomy.sql), so no schema change is needed here.

do $$
declare
  v_argent_id uuid;
  v_hommes_id uuid;
begin
  select id into v_argent_id from categories where slug = 'bijoux-argent-925';
  if v_argent_id is null then
    raise exception 'bijoux-argent-925 category not found — run 0006_seed_catalogue.sql first';
  end if;

  insert into categories (slug, name_fr, name_ar, parent_id, sort_order)
  values ('hommes-argent', 'Hommes', 'رجالي', v_argent_id, 9)
  returning id into v_hommes_id;

  insert into categories (slug, name_fr, name_ar, parent_id, sort_order) values
    ('colliers-hommes-argent', 'Colliers', 'قلادات', v_hommes_id, 1),
    ('bagues-hommes-argent', 'Bagues', 'خواتم', v_hommes_id, 2),
    ('gourmettes-hommes-argent', 'Gourmettes', 'غورميت', v_hommes_id, 3);
end $$;
