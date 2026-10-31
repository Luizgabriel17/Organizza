create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (family_id, name),
  unique (family_id, id)
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  sold_at timestamptz not null default now(),
  product_name text not null check (length(trim(product_name)) between 1 and 160),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  total_amount numeric(14,2) generated always as (quantity * unit_price) stored,
  payment_method text not null check (payment_method in ('cash', 'pix', 'other')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (family_id, id)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  description text not null check (length(trim(description)) between 1 and 160),
  category_id uuid,
  amount numeric(12,2) not null check (amount > 0),
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  paid_at timestamptz,
  payment_method text check (payment_method in ('cash', 'pix', 'other')),
  is_recurring boolean not null default false,
  recurrence_frequency text check (recurrence_frequency in ('monthly')),
  recurrence_day smallint check (recurrence_day between 1 and 31),
  recurrence_anchor_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (family_id, id),
  foreign key (family_id, category_id) references public.categories(family_id, id),
  foreign key (family_id, recurrence_anchor_id) references public.expenses(family_id, id),
  check ((is_recurring and recurrence_frequency is not null and recurrence_day is not null)
      or (not is_recurring and recurrence_frequency is null and recurrence_day is null))
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  customer_name text not null check (length(trim(customer_name)) between 1 and 160),
  customer_phone text,
  description text not null check (length(trim(description)) between 1 and 500),
  quantity integer not null default 1 check (quantity > 0),
  total_amount numeric(12,2) not null check (total_amount > 0),
  order_date date not null default (now() at time zone 'America/Fortaleza')::date,
  due_date date not null,
  delivery_date date,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'ready', 'delivered', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (family_id, id)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  order_id uuid not null,
  product_name text not null check (length(trim(product_name)) between 1 and 160),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  subtotal numeric(14,2) generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now(),
  unique (family_id, order_id, id),
  foreign key (family_id, order_id) references public.orders(family_id, id) on delete cascade
);

create table public.payment_records (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  order_id uuid,
  expense_id uuid,
  amount numeric(12,2) not null check (amount > 0),
  payment_type text not null check (payment_type in ('order', 'expense')),
  payment_method text not null check (payment_method in ('cash', 'pix', 'other')),
  paid_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  foreign key (family_id, order_id) references public.orders(family_id, id) on delete restrict,
  foreign key (family_id, expense_id) references public.expenses(family_id, id) on delete restrict,
  check ((payment_type = 'order' and order_id is not null and expense_id is null)
      or (payment_type = 'expense' and expense_id is not null and order_id is null))
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  occurred_at timestamptz not null default now()
);

create index sales_family_sold_at_idx on public.sales(family_id, sold_at desc) where deleted_at is null;
create index sales_product_name_idx on public.sales(family_id, product_name);
create index expenses_family_due_idx on public.expenses(family_id, due_date) where deleted_at is null;
create unique index expenses_recurring_occurrence_idx
  on public.expenses(recurrence_anchor_id, due_date)
  where recurrence_anchor_id is not null;
create index orders_family_due_idx on public.orders(family_id, due_date) where deleted_at is null;
create index payment_records_family_paid_idx on public.payment_records(family_id, paid_at desc);
create index payment_records_order_idx on public.payment_records(order_id) where order_id is not null;
create index audit_logs_family_date_idx on public.audit_logs(family_id, occurred_at desc);

create function public.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger families_touch_updated_at before update on public.families
for each row execute function public.touch_updated_at();
create trigger sales_touch_updated_at before update on public.sales
for each row execute function public.touch_updated_at();
create trigger expenses_touch_updated_at before update on public.expenses
for each row execute function public.touch_updated_at();
create trigger orders_touch_updated_at before update on public.orders
for each row execute function public.touch_updated_at();

create function public.protect_cancelled_order()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.status = 'cancelled' and new.status not in ('cancelled', 'todo') then
    raise exception 'Reative a encomenda antes de avançar seu andamento';
  end if;
  return new;
end;
$$;

create trigger protect_cancelled_order_trigger before update of status on public.orders
for each row execute function public.protect_cancelled_order();

create function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  old_row jsonb;
  new_row jsonb;
  target_family uuid;
  target_id uuid;
begin
  if tg_op <> 'INSERT' then old_row := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then new_row := to_jsonb(new); end if;
  target_family := coalesce((new_row->>'family_id')::uuid, (old_row->>'family_id')::uuid);
  target_id := coalesce((new_row->>'id')::uuid, (old_row->>'id')::uuid);
  insert into public.audit_logs(family_id, table_name, record_id, action)
  values (target_family, tg_table_name, target_id, lower(tg_op));
  return coalesce(new, old);
end;
$$;

create trigger sales_audit after insert or update or delete on public.sales
for each row execute function public.write_audit_log();
create trigger expenses_audit after insert or update or delete on public.expenses
for each row execute function public.write_audit_log();
create trigger orders_audit after insert or update or delete on public.orders
for each row execute function public.write_audit_log();
create trigger payment_records_audit after insert or update or delete on public.payment_records
for each row execute function public.write_audit_log();

create function public.record_order_payment(
  target_order uuid,
  payment_amount numeric,
  method text,
  payment_time timestamptz default now(),
  payment_note text default null
)
returns uuid language plpgsql set search_path = ''
as $$
declare
  target_family uuid;
  order_total numeric;
  order_status text;
  received numeric;
  new_payment uuid;
begin
  select family_id, total_amount, status into target_family, order_total, order_status
  from public.orders where id = target_order and deleted_at is null for update;
  if target_family is null then raise exception 'Encomenda não encontrada'; end if;
  if payment_amount <= 0 or method not in ('cash', 'pix', 'other') then
    raise exception 'Valor ou forma de pagamento inválidos';
  end if;
  if order_status = 'cancelled' then raise exception 'Não é possível receber pagamento de encomenda cancelada'; end if;
  select coalesce(sum(amount), 0) into received from public.payment_records
  where order_id = target_order and payment_type = 'order';
  if received + payment_amount > order_total then raise exception 'O recebimento ultrapassa o saldo restante'; end if;
  insert into public.payment_records(family_id, order_id, amount, payment_type, payment_method, paid_at, notes)
  values (target_family, target_order, payment_amount, 'order', method, payment_time, payment_note)
  returning id into new_payment;
  return new_payment;
end;
$$;

create function public.record_expense_payment(
  target_expense uuid,
  payment_amount numeric,
  method text,
  payment_time timestamptz default now(),
  payment_note text default null
)
returns uuid language plpgsql set search_path = ''
as $$
declare
  target_family uuid;
  expense_amount numeric;
  expense_status text;
  new_payment uuid;
begin
  select family_id, amount, status into target_family, expense_amount, expense_status
  from public.expenses where id = target_expense and deleted_at is null for update;
  if target_family is null then raise exception 'Conta não encontrada'; end if;
  if expense_status <> 'pending' or payment_amount <> expense_amount or payment_amount <= 0
     or method not in ('cash', 'pix', 'other') then
    raise exception 'Pagamento inválido ou conta já quitada';
  end if;
  update public.expenses set status = 'paid', paid_at = payment_time, payment_method = method
  where id = target_expense;
  insert into public.payment_records(family_id, expense_id, amount, payment_type, payment_method, paid_at, notes)
  values (target_family, target_expense, payment_amount, 'expense', method, payment_time, payment_note)
  returning id into new_payment;
  return new_payment;
end;
$$;

create function public.generate_recurring_expenses(target_family uuid)
returns integer language plpgsql set search_path = ''
as $$
declare
  template record;
  last_due date;
  next_due date;
  horizon date := (date_trunc('month', (now() at time zone 'America/Fortaleza')::date) + interval '12 months')::date;
  day_limit integer;
  generated integer := 0;
begin
  if not exists (select 1 from public.families where id = target_family) then
    raise exception 'Família não encontrada';
  end if;
  for template in
    select * from public.expenses
    where family_id = target_family and is_recurring and recurrence_anchor_id is null and deleted_at is null
  loop
    select greatest(template.due_date, coalesce(max(due_date), template.due_date))
      into last_due from public.expenses
      where recurrence_anchor_id = template.id and family_id = target_family;
    loop
      next_due := (date_trunc('month', last_due::timestamp) + interval '1 month')::date;
      exit when next_due >= horizon;
      day_limit := extract(day from (date_trunc('month', next_due::timestamp) + interval '1 month - 1 day'))::integer;
      next_due := make_date(extract(year from next_due)::integer, extract(month from next_due)::integer, least(template.recurrence_day, day_limit));
      insert into public.expenses (
        family_id, description, category_id, amount, due_date, recurrence_anchor_id, notes
      ) values (
        target_family, template.description, template.category_id, template.amount, next_due, template.id, template.notes
      ) on conflict (recurrence_anchor_id, due_date) where recurrence_anchor_id is not null do nothing;
      if found then generated := generated + 1; end if;
      last_due := next_due;
    end loop;
  end loop;
  return generated;
end;
$$;

create function public.create_order_with_items(
  target_family uuid,
  customer text,
  phone text,
  deadline date,
  order_notes text,
  items jsonb
)
returns uuid language plpgsql set search_path = ''
as $$
declare
  item jsonb;
  item_name text;
  item_quantity integer;
  item_price numeric;
  total numeric := 0;
  total_quantity integer := 0;
  summary text := '';
  new_order uuid;
begin
  if not exists (select 1 from public.families where id = target_family) then
    raise exception 'Família não encontrada';
  end if;
  if length(trim(customer)) not between 1 and 160 or deadline is null
     or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) not between 1 and 30 then
    raise exception 'Dados da encomenda inválidos';
  end if;
  for item in select value from jsonb_array_elements(items)
  loop
    item_name := trim(item->>'product_name');
    item_quantity := (item->>'quantity')::integer;
    item_price := (item->>'unit_price')::numeric;
    if length(item_name) not between 1 and 160 or item_quantity <= 0 or item_price < 0 then
      raise exception 'Produto, quantidade ou preço inválido';
    end if;
    total := total + item_quantity * item_price;
    total_quantity := total_quantity + item_quantity;
    summary := concat_ws(', ', nullif(summary, ''), item_quantity::text || ' x ' || item_name);
  end loop;
  if total <= 0 then raise exception 'O total da encomenda deve ser maior que zero'; end if;
  insert into public.orders (family_id, customer_name, customer_phone, description, quantity, total_amount, due_date, notes)
  values (target_family, trim(customer), nullif(trim(phone), ''), summary, total_quantity, total, deadline, order_notes)
  returning id into new_order;
  for item in select value from jsonb_array_elements(items)
  loop
    insert into public.order_items (family_id, order_id, product_name, quantity, unit_price)
    values (target_family, new_order, trim(item->>'product_name'), (item->>'quantity')::integer, (item->>'unit_price')::numeric);
  end loop;
  return new_order;
end;
$$;

create function public.update_order_with_items(
  target_order uuid,
  customer text,
  phone text,
  deadline date,
  order_notes text,
  items jsonb
)
returns void language plpgsql set search_path = ''
as $$
declare
  target_family uuid;
  received numeric;
  total numeric := 0;
  total_quantity integer := 0;
  summary text := '';
  item jsonb;
  item_name text;
  item_quantity integer;
  item_price numeric;
begin
  select family_id into target_family
  from public.orders where id = target_order and deleted_at is null for update;
  if target_family is null then raise exception 'Encomenda não encontrada'; end if;
  if length(trim(customer)) not between 1 and 160 or deadline is null
     or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) not between 1 and 30 then
    raise exception 'Dados da encomenda inválidos';
  end if;
  for item in select value from jsonb_array_elements(items)
  loop
    item_name := trim(item->>'product_name');
    item_quantity := (item->>'quantity')::integer;
    item_price := (item->>'unit_price')::numeric;
    if length(item_name) not between 1 and 160 or item_quantity <= 0 or item_price < 0 then
      raise exception 'Produto, quantidade ou preço inválido';
    end if;
    total := total + item_quantity * item_price;
    total_quantity := total_quantity + item_quantity;
    summary := concat_ws(', ', nullif(summary, ''), item_quantity::text || ' x ' || item_name);
  end loop;
  if total <= 0 then raise exception 'O total da encomenda deve ser maior que zero'; end if;
  select coalesce(sum(amount), 0) into received from public.payment_records
  where order_id = target_order and payment_type = 'order';
  if received > total then raise exception 'O novo total não pode ficar abaixo do valor já recebido'; end if;
  update public.orders
  set customer_name = trim(customer), customer_phone = nullif(trim(phone), ''),
      description = summary, quantity = total_quantity, total_amount = total,
      due_date = deadline, notes = order_notes
  where id = target_order;
  delete from public.order_items where order_id = target_order;
  for item in select value from jsonb_array_elements(items)
  loop
    insert into public.order_items (family_id, order_id, product_name, quantity, unit_price)
    values (target_family, target_order, trim(item->>'product_name'), (item->>'quantity')::integer, (item->>'unit_price')::numeric);
  end loop;
end;
$$;

create function public.cancel_pending_expense(target_expense uuid)
returns void language plpgsql set search_path = ''
as $$
declare
  target_status text;
begin
  select status into target_status from public.expenses
  where id = target_expense and deleted_at is null for update;
  if target_status is null then raise exception 'Conta não encontrada'; end if;
  if target_status <> 'pending' then raise exception 'Somente contas pendentes podem ser canceladas'; end if;
  update public.expenses set status = 'cancelled' where id = target_expense;
end;
$$;
