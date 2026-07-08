-- Loop 1: sucursales, asignación de gerentes, tipos de compensación,
-- y edición de moneda de la organización.

create table branches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  address text,
  google_place_id text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, google_place_id)
);

create index branches_org_id_idx on branches (org_id);

create table branch_managers (
  branch_id uuid not null references branches (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  primary key (branch_id, profile_id)
);

create index branch_managers_profile_id_idx on branch_managers (profile_id);

create table compensation_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  default_unit_cost numeric not null default 0,
  is_active boolean not null default true
);

create index compensation_types_org_id_idx on compensation_types (org_id);

-- Seed automático de tipos de compensación default al crear una organización.
create function seed_compensation_types()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.compensation_types (org_id, name, default_unit_cost)
  values
    (new.id, 'Descuento', 0),
    (new.id, 'Postre bonificado', 0),
    (new.id, 'Bebida bonificada', 0),
    (new.id, 'Devolución', 0),
    (new.id, 'Plato rehecho', 0),
    (new.id, 'Otro', 0);
  return new;
end;
$$;

create trigger on_organization_created
  after insert on organizations
  for each row execute function seed_compensation_types();

-- security definer: branches y branch_managers se referencian mutuamente en
-- sus políticas (branches necesita saber si el usuario es su manager;
-- branch_managers necesita saber el org_id de la sucursal). Sin estas
-- funciones, evaluar una policy dispara la otra y Postgres detecta
-- recursión infinita (mismo motivo que get_user_org_id() en profiles).
create function is_manager_of_branch(target_branch_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from branch_managers
    where branch_id = target_branch_id and profile_id = auth.uid()
  )
$$;

create function get_branch_org_id(target_branch_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select org_id from branches where id = target_branch_id
$$;

alter table branches enable row level security;
alter table branch_managers enable row level security;
alter table compensation_types enable row level security;

-- branches: admin ve/edita todas las de su org; manager solo lee las asignadas.
create policy "branches: select propia org (admin todas, manager asignadas)"
  on branches for select
  using (
    org_id = get_user_org_id()
    and (get_user_role() = 'admin' or is_manager_of_branch(branches.id))
  );

create policy "branches: admin inserta en su org"
  on branches for insert
  with check (org_id = get_user_org_id() and get_user_role() = 'admin');

create policy "branches: admin actualiza su org"
  on branches for update
  using (org_id = get_user_org_id() and get_user_role() = 'admin')
  with check (org_id = get_user_org_id() and get_user_role() = 'admin');

create policy "branches: admin elimina su org"
  on branches for delete
  using (org_id = get_user_org_id() and get_user_role() = 'admin');

-- branch_managers: admin administra asignaciones de su org; el manager ve las suyas.
create policy "branch_managers: select admin de la org o el propio manager"
  on branch_managers for select
  using (
    profile_id = auth.uid()
    or (get_branch_org_id(branch_managers.branch_id) = get_user_org_id() and get_user_role() = 'admin')
  );

create policy "branch_managers: admin inserta en su org"
  on branch_managers for insert
  with check (
    get_branch_org_id(branch_managers.branch_id) = get_user_org_id() and get_user_role() = 'admin'
  );

create policy "branch_managers: admin elimina en su org"
  on branch_managers for delete
  using (
    get_branch_org_id(branch_managers.branch_id) = get_user_org_id() and get_user_role() = 'admin'
  );

-- compensation_types: toda la org lee; solo admin edita.
create policy "compensation_types: select propia org"
  on compensation_types for select
  using (org_id = get_user_org_id());

create policy "compensation_types: admin inserta en su org"
  on compensation_types for insert
  with check (org_id = get_user_org_id() and get_user_role() = 'admin');

create policy "compensation_types: admin actualiza su org"
  on compensation_types for update
  using (org_id = get_user_org_id() and get_user_role() = 'admin')
  with check (org_id = get_user_org_id() and get_user_role() = 'admin');

-- organizations: el admin puede editar la moneda (y otros datos) de su propia org.
create policy "organizations: admin actualiza su propia org"
  on organizations for update
  using (id = get_user_org_id() and get_user_role() = 'admin')
  with check (id = get_user_org_id() and get_user_role() = 'admin');
