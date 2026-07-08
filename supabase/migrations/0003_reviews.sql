-- Loop 2: ingesta de Google Reviews (reviews, sync_jobs).

create table reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  branch_id uuid not null references branches (id) on delete cascade,
  provider_review_id text not null,
  author_name text,
  rating int not null check (rating between 1 and 5),
  text text,
  review_date date,
  fetched_at timestamptz not null default now(),
  analysis_status text not null default 'pending' check (analysis_status in ('pending', 'done', 'failed')),
  unique (branch_id, provider_review_id)
);

create index reviews_org_id_idx on reviews (org_id);
create index reviews_branch_id_idx on reviews (branch_id);

create table sync_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  branch_id uuid not null references branches (id) on delete cascade,
  kind text not null check (kind in ('fetch', 'analyze')),
  status text not null check (status in ('running', 'success', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stats jsonb,
  error text
);

create index sync_jobs_org_id_idx on sync_jobs (org_id);
create index sync_jobs_branch_id_idx on sync_jobs (branch_id);

alter table reviews enable row level security;
alter table sync_jobs enable row level security;

-- reviews: solo lectura para la app (admin todas las de su org, manager solo
-- las de sus sucursales asignadas). Los inserts los hace exclusivamente
-- /api/sync-reviews con el cliente de service role, que bypassa RLS.
create policy "reviews: select propia org (admin todas, manager asignadas)"
  on reviews for select
  using (
    org_id = get_user_org_id()
    and (get_user_role() = 'admin' or is_manager_of_branch(reviews.branch_id))
  );

-- sync_jobs: solo el admin de la org ve el historial de corridas.
create policy "sync_jobs: select admin de su org"
  on sync_jobs for select
  using (org_id = get_user_org_id() and get_user_role() = 'admin');
