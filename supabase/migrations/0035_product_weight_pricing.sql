-- Optional weight-based pricing helper for WEBSITE products.
--
-- The shop till has sold bulk silver by weight since 0022/0027: three grades
-- (rhodie / bataille / local), each a store_products row carrying its own
-- price_per_gram. Website products had no equivalent — the owner priced a
-- silver piece by doing weight x rate on a calculator and typing the result.
--
-- These two columns let him record the inputs instead. They are deliberately
-- NOT a pricing_mode: products.price stays the single source of truth that
-- place_order and the storefront read, exactly as before. The admin form uses
-- these to COMPUTE a suggested price that the owner then accepts into
-- products.price, and keeping them means re-opening the product later shows
-- the weight and grade it was priced from instead of a bare number.
--
-- Both nullable: a watch or a steel bracelet has no silver grade, and the
-- existing manual flow must keep working untouched.

alter table products
  add column if not exists weight_grams numeric(10, 3)
    check (weight_grams is null or weight_grams > 0),
  add column if not exists silver_type text
    check (silver_type is null or silver_type in ('rhodie', 'bataille', 'local'));

comment on column products.weight_grams is
  'Optional. Weight in grams used to derive price from a silver grade rate. Display/derivation only — products.price remains authoritative.';
comment on column products.silver_type is
  'Optional. Which bulk-silver grade this piece was priced from; mirrors store_products.silver_type.';
