-- Loop 0: organizations, profiles, RLS, trigger de creación de perfil

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'ARS',
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  full_name text,
  role text not null check (role in ('admin', 'manager')),
  created_at timestamptz not null default now()
);

create index profiles_org_id_idx on profiles (org_id);

-- security definer: evita la recursión infinita de una política de RLS en
-- profiles que necesitaría leer profiles para saber el org_id del usuario.
create function get_user_org_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select org_id from profiles where id = auth.uid()
$$;

create function get_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from profiles where id = auth.uid()
$$;

alter table organizations enable row level security;
alter table profiles enable row level security;

create policy "org: solo la propia organización"
  on organizations for select
  using (id = get_user_org_id());

create policy "profiles: solo perfiles de la propia organización"
  on profiles for select
  using (org_id = get_user_org_id());

create policy "profiles: usuario actualiza su propio perfil"
  on profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and org_id = get_user_org_id()
    and role = get_user_role()
  );

-- Trigger: al crearse un auth.users, crea el profile correspondiente
-- leyendo org_id y role de raw_user_meta_data (seteado en el signup/invite).
create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, org_id, full_name, role)
  values (
    new.id,
    (new.raw_user_meta_data ->> 'org_id')::uuid,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_user_meta_data ->> 'role', 'manager')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
