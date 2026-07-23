-- Sample catalogue for previewing the storefront and testing a real order
-- end-to-end. Images are hotlink-safe Unsplash CDN URLs (same source already
-- used for editorial placeholder art in src/lib/editorialImages.ts). Safe to
-- re-run: each insert is `on conflict (slug) do nothing`, so a repeat run
-- adds nothing new. Delete these from /admin/produits whenever real product
-- photos are ready.

with p as (
  insert into products (slug, name_fr, name_ar, description_fr, description_ar, price, compare_at_price, category_id, stock, colors, featured, status)
  values (
    'bague-solitaire-eclat', 'Bague Solitaire Éclat', 'خاتم سوليتير لامع',
    'Une bague intemporelle en argent 925, sertie d''une pierre solitaire brillante. Finition polie miroir.',
    'خاتم فضة 925 خالد، مرصع بحجر سوليتير لامع. تشطيب لامع كالمرآة.',
    4500, 5500, (select id from categories where slug = 'bagues-argent'), 25, '["Argenté"]'::jsonb, true, 'active'
  )
  on conflict (slug) do nothing
  returning id
)
insert into product_images (product_id, url, alt, sort_order)
select id, 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?q=80&w=1200&auto=format&fit=crop', 'Bague Solitaire Éclat', 0 from p;

with p as (
  insert into products (slug, name_fr, name_ar, description_fr, description_ar, price, compare_at_price, category_id, stock, colors, featured, status)
  values (
    'collier-perle-elegance', 'Collier Perle Élégance', 'قلادة لؤلؤ أنيقة',
    'Collier en argent 925 orné d''une perle de culture, présenté dans son écrin.',
    'قلادة من فضة 925 مزينة بلؤلؤة طبيعية، تُقدَّم في علبتها الأنيقة.',
    6200, null, (select id from categories where slug = 'colliers-argent'), 15, '[]'::jsonb, false, 'active'
  )
  on conflict (slug) do nothing
  returning id
)
insert into product_images (product_id, url, alt, sort_order)
select id, 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=1200&auto=format&fit=crop', 'Collier Perle Élégance', 0 from p;

with p as (
  insert into products (slug, name_fr, name_ar, description_fr, description_ar, price, compare_at_price, category_id, stock, colors, featured, status)
  values (
    'gourmette-argent-massif-homme', 'Gourmette Argent Massif', 'غورميت فضة صلبة',
    'Gourmette homme en argent 925 massif, maillons larges et fermoir sécurisé.',
    'غورميت رجالي من فضة 925 صلبة، بحلقات عريضة وإغلاق آمن.',
    5800, null, (select id from categories where slug = 'gourmettes-hommes-argent'), 20, '[]'::jsonb, false, 'active'
  )
  on conflict (slug) do nothing
  returning id
)
insert into product_images (product_id, url, alt, sort_order)
select id, 'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?q=80&w=1200&auto=format&fit=crop', 'Gourmette Argent Massif', 0 from p;

with p as (
  insert into products (slug, name_fr, name_ar, description_fr, description_ar, price, compare_at_price, category_id, stock, colors, featured, status)
  values (
    'bague-chevaliere-homme', 'Bague Chevalière Homme', 'خاتم شواليير رجالي',
    'Chevalière homme en argent 925, design épuré et robuste pour un port quotidien.',
    'خاتم شواليير رجالي من فضة 925، بتصميم أنيق ومتين للاستخدام اليومي.',
    4900, null, (select id from categories where slug = 'bagues-hommes-argent'), 18, '[]'::jsonb, false, 'active'
  )
  on conflict (slug) do nothing
  returning id
)
insert into product_images (product_id, url, alt, sort_order)
select id, 'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?q=80&w=1200&auto=format&fit=crop', 'Bague Chevalière Homme', 0 from p;

with p as (
  insert into products (slug, name_fr, name_ar, description_fr, description_ar, price, compare_at_price, category_id, stock, colors, featured, status)
  values (
    'collier-chaine-homme', 'Collier Chaîne Homme', 'سلسلة رقبة رجالية',
    'Chaîne homme en argent 925, maillons figaro, longueur ajustée pour un port sous ou sur le col.',
    'سلسلة رقبة رجالية من فضة 925، حلقات فيغارو، بطول مناسب للارتداء.',
    5200, null, (select id from categories where slug = 'colliers-hommes-argent'), 12, '[]'::jsonb, false, 'active'
  )
  on conflict (slug) do nothing
  returning id
)
insert into product_images (product_id, url, alt, sort_order)
select id, 'https://images.unsplash.com/photo-1610694955371-d4a3e0ce4b52?q=80&w=1200&auto=format&fit=crop', 'Collier Chaîne Homme', 0 from p;

with p as (
  insert into products (slug, name_fr, name_ar, description_fr, description_ar, price, compare_at_price, category_id, stock, colors, featured, status)
  values (
    'bracelet-diamant-simule', 'Bracelet Diamant Simulé', 'سوار بأحجار الماس الصناعي',
    'Bracelet en argent 925 pavé de zircons taille diamant, éclat maximal.',
    'سوار من فضة 925 مرصع بأحجار الزركون المصقولة على شكل الماس، بريق فائق.',
    7300, 8900, (select id from categories where slug = 'bracelets-argent'), 10, '["Argenté"]'::jsonb, true, 'active'
  )
  on conflict (slug) do nothing
  returning id
)
insert into product_images (product_id, url, alt, sort_order)
select id, 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?q=80&w=1200&auto=format&fit=crop', 'Bracelet Diamant Simulé', 0 from p;

with p as (
  insert into products (slug, name_fr, name_ar, description_fr, description_ar, price, compare_at_price, category_id, stock, colors, featured, status)
  values (
    'boucles-creoles-or', 'Boucles d''Oreilles Créoles', 'أقراط كريول',
    'Créoles fines plaquées or sur argent 925, légères et intemporelles.',
    'أقراط كريول رفيعة مطلية بالذهب على فضة 925، خفيفة الوزن وخالدة.',
    3900, null, (select id from categories where slug = 'boucles-argent'), 30, '["Doré"]'::jsonb, false, 'active'
  )
  on conflict (slug) do nothing
  returning id
)
insert into product_images (product_id, url, alt, sort_order)
select id, 'https://images.unsplash.com/photo-1617038220319-276d3cfab638?q=80&w=1200&auto=format&fit=crop', 'Boucles d''Oreilles Créoles', 0 from p;

with p as (
  insert into products (slug, name_fr, name_ar, description_fr, description_ar, price, compare_at_price, category_id, stock, colors, featured, status)
  values (
    'montre-chronographe-homme', 'Montre Chronographe Homme', 'ساعة كرونوغراف رجالية',
    'Montre chronographe homme, boîtier acier, bracelet cuir, étanche 5 ATM.',
    'ساعة كرونوغراف رجالية، علبة من الفولاذ، سوار جلدي، مقاومة للماء حتى 5 ضغط جوي.',
    12500, null, (select id from categories where slug = 'montres-homme'), 8, '[]'::jsonb, true, 'active'
  )
  on conflict (slug) do nothing
  returning id
)
insert into product_images (product_id, url, alt, sort_order)
select id, 'https://images.unsplash.com/photo-1587836374828-4dbafa94cf0e?q=80&w=1200&auto=format&fit=crop', 'Montre Chronographe Homme', 0 from p;
