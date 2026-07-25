-- products.colors moves from a plain string label ("Argenté") to a
-- structured swatch { label_fr, label_ar, hex, image_url } so the product
-- page can render real color swatches and jump the gallery to a color's
-- own photo when one is set. image_url stays null until an admin uploads
-- one via the new per-color upload in ProductForm.
-- Idempotent: only touches rows whose colors array still has plain strings.

update products
set colors = (
  select coalesce(jsonb_agg(
    case jsonb_typeof(elem)
      when 'string' then jsonb_build_object(
        'label_fr', elem #>> '{}',
        'label_ar', case elem #>> '{}'
          when 'Argenté' then 'فضي'
          when 'Argent' then 'فضي'
          when 'Doré' then 'ذهبي'
          when 'Or' then 'ذهبي'
          when 'Noir' then 'أسود'
          when 'Blanc' then 'أبيض'
          when 'Rose' then 'وردي'
          else elem #>> '{}'
        end,
        'hex', case elem #>> '{}'
          when 'Argenté' then '#C0C0C0'
          when 'Argent' then '#C0C0C0'
          when 'Doré' then '#D4AF37'
          when 'Or' then '#D4AF37'
          when 'Noir' then '#1A1A1A'
          when 'Blanc' then '#F5F5F5'
          when 'Rose' then '#E8B4B8'
          else '#B8B8B8'
        end,
        'image_url', null
      )
      else elem
    end
  ), '[]'::jsonb)
  from jsonb_array_elements(colors) elem
)
where jsonb_typeof(colors) = 'array'
  and exists (
    select 1 from jsonb_array_elements(colors) e where jsonb_typeof(e) = 'string'
  );
