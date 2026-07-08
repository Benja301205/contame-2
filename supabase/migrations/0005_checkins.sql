-- Loop 4: check-in diario de compensaciones (checkins, compensation_items).

-- "Hoy" para las policies de check-in en huso horario argentino, no UTC.
-- Ver lib/checkins/today.ts para el equivalente en la app (misma decisión,
-- un solo lugar por lado — no se puede compartir literalmente el código
-- entre Postgres y Node, pero ambos usan America/Argentina/Buenos_Aires
-- como única fuente de verdad de "hoy").
create function checkin_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date
$$;

create table checkins (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  branch_id uuid not null references branches (id) on delete cascade,
  manager_id uuid not null references profiles (id) on delete cascade,
  checkin_date date not null,
  status text not null check (status in ('pending', 'completed', 'skipped')),
  completed_at timestamptz,
  unique (branch_id, checkin_date)
);

create index checkins_org_id_idx on checkins (org_id);
create index checkins_branch_id_idx on checkins (branch_id);

create table compensation_items (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references checkins (id) on delete cascade,
  type_id uuid not null references compensation_types (id),
  quantity int not null check (quantity >= 0),
  unit_cost numeric not null check (unit_cost >= 0),
  total numeric generated always as (quantity * unit_cost) stored,
  reason_category text not null check (reason_category in (
    'demora', 'atencion', 'calidad_comida', 'comida_fria', 'limpieza',
    'precio', 'pedido_incorrecto', 'ambiente', 'otro'
  )),
  note text
);

create index compensation_items_checkin_id_idx on compensation_items (checkin_id);

-- security definer: compensation_items no tiene org_id/branch_id propios
-- (referencia a checkins vía checkin_id), mismo patrón que review_analysis
-- en el Loop 3 para evitar recursión de RLS.
create function get_checkin_org_id(target_checkin_id uuid)
returns uuid language sql security definer set search_path = public stable
as $$ select org_id from checkins where id = target_checkin_id $$;

create function get_checkin_branch_id(target_checkin_id uuid)
returns uuid language sql security definer set search_path = public stable
as $$ select branch_id from checkins where id = target_checkin_id $$;

create function get_checkin_manager_id(target_checkin_id uuid)
returns uuid language sql security definer set search_path = public stable
as $$ select manager_id from checkins where id = target_checkin_id $$;

create function get_checkin_date(target_checkin_id uuid)
returns date language sql security definer set search_path = public stable
as $$ select checkin_date from checkins where id = target_checkin_id $$;

alter table checkins enable row level security;
alter table compensation_items enable row level security;

create policy "checkins: select propia org"
  on checkins for select
  using (
    org_id = get_user_org_id()
    and (get_user_role() = 'admin' or is_manager_of_branch(checkins.branch_id))
  );

-- Insert habilita el backfill retroactivo (hasta 7 días atrás), pero no
-- fechas futuras ni más viejas que la ventana del banner de pendientes.
create policy "checkins: manager inserta en su sucursal hasta 7 dias atras"
  on checkins for insert
  with check (
    org_id = get_user_org_id()
    and get_user_role() = 'manager'
    and manager_id = auth.uid()
    and is_manager_of_branch(branch_id)
    and checkin_date <= checkin_today()
    and checkin_date >= checkin_today() - 7
  );

-- Update solo el mismo día: un check-in recién cargado hoy sigue editable
-- hasta medianoche (hora argentina); uno cargado retroactivo (de un día
-- pendiente anterior) queda bloqueado apenas se crea.
create policy "checkins: manager actualiza solo el mismo dia"
  on checkins for update
  using (manager_id = auth.uid() and checkin_date = checkin_today())
  with check (manager_id = auth.uid() and checkin_date = checkin_today());

create policy "compensation_items: select propia org"
  on compensation_items for select
  using (
    get_checkin_org_id(compensation_items.checkin_id) = get_user_org_id()
    and (
      get_user_role() = 'admin'
      or is_manager_of_branch(get_checkin_branch_id(compensation_items.checkin_id))
    )
  );

create policy "compensation_items: manager inserta hasta 7 dias atras"
  on compensation_items for insert
  with check (
    get_checkin_manager_id(compensation_items.checkin_id) = auth.uid()
    and get_checkin_date(compensation_items.checkin_id) <= checkin_today()
    and get_checkin_date(compensation_items.checkin_id) >= checkin_today() - 7
  );

create policy "compensation_items: manager actualiza solo el mismo dia"
  on compensation_items for update
  using (
    get_checkin_manager_id(compensation_items.checkin_id) = auth.uid()
    and get_checkin_date(compensation_items.checkin_id) = checkin_today()
  )
  with check (
    get_checkin_manager_id(compensation_items.checkin_id) = auth.uid()
    and get_checkin_date(compensation_items.checkin_id) = checkin_today()
  );

create policy "compensation_items: manager elimina solo el mismo dia"
  on compensation_items for delete
  using (
    get_checkin_manager_id(compensation_items.checkin_id) = auth.uid()
    and get_checkin_date(compensation_items.checkin_id) = checkin_today()
  );
