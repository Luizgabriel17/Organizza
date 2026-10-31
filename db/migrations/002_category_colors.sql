alter table public.categories
  add column if not exists color text;

with palette as (
  select array[
    '#4F7CAC', '#7B61A8', '#C46B35', '#2F855A', '#B3475B',
    '#218C8C', '#9A6B18', '#4F5FA8', '#A34D8F', '#657B42'
  ]::text[] as colors
), assigned as (
  select category.id,
    palette.colors[
      ((row_number() over (partition by category.family_id order by category.created_at, category.id) - 1)
        % array_length(palette.colors, 1)) + 1
    ] as color
  from public.categories as category
  cross join palette
  where category.color is null
)
update public.categories as category
set color = assigned.color
from assigned
where category.id = assigned.id;

alter table public.categories
  alter column color set default '#4F7CAC',
  alter column color set not null;

alter table public.categories
  drop constraint if exists categories_color_format_check;

alter table public.categories
  add constraint categories_color_format_check check (color ~ '^#[0-9A-Fa-f]{6}$');
