-- Loop 6: motor de cuantificación de pérdidas $ (loss_snapshots + parámetros).

alter table organizations
  add column avg_ticket numeric,
  add column affected_factor numeric not null default 1;

create table loss_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  branch_id uuid not null references branches (id) on delete cascade,
  period date not null,
  compensation_total numeric not null default 0,
  estimated_review_loss numeric not null default 0,
  method jsonb,
  computed_at timestamptz not null default now(),
  unique (org_id, branch_id, period)
);

create index loss_snapshots_org_id_idx on loss_snapshots (org_id);
create index loss_snapshots_branch_id_idx on loss_snapshots (branch_id);

alter table loss_snapshots enable row level security;

-- Solo lectura para la app; los snapshots los escribe exclusivamente el
-- motor (service role vía /api/recompute-loss o la Server Action de
-- Settings), mismo patrón que sync_jobs/reviews.
create policy "loss_snapshots: select propia org"
  on loss_snapshots for select
  using (
    org_id = get_user_org_id()
    and (get_user_role() = 'admin' or is_manager_of_branch(loss_snapshots.branch_id))
  );

-- Pérdida real (compensation_items) y estimada (reviews negativas × avg_ticket
-- × affected_factor) de una sucursal en un período [start, end). Toda la
-- aritmética de plata en numeric, no en float de JS. Sin security definer:
-- corre con los privilegios del que llama (siempre service role en la
-- práctica, ya que solo el motor invoca esto).
create function compute_branch_loss(
  p_org_id uuid,
  p_branch_id uuid,
  p_period_start date,
  p_period_end date
)
returns table (
  compensation_total numeric,
  negative_review_count bigint,
  avg_ticket numeric,
  affected_factor numeric,
  estimated_review_loss numeric
)
language sql
stable
as $$
  with comp as (
    select coalesce(sum(ci.total), 0) as total
    from checkins c
    join compensation_items ci on ci.checkin_id = c.id
    where c.org_id = p_org_id
      and c.branch_id = p_branch_id
      and c.checkin_date >= p_period_start
      and c.checkin_date < p_period_end
  ),
  neg as (
    select count(*) as cnt
    from reviews r
    join review_analysis ra on ra.review_id = r.id
    where r.org_id = p_org_id
      and r.branch_id = p_branch_id
      and r.review_date >= p_period_start
      and r.review_date < p_period_end
      and ra.sentiment = 'negative'
  ),
  org as (
    select o.avg_ticket, o.affected_factor from organizations o where o.id = p_org_id
  )
  select
    comp.total,
    neg.cnt,
    org.avg_ticket,
    org.affected_factor,
    case
      when org.avg_ticket is null then 0::numeric
      else neg.cnt::numeric * org.avg_ticket * org.affected_factor
    end
  from comp, neg, org
$$;

-- Breakdown de la pérdida real por tipo de compensación en el período.
create function branch_compensation_breakdown(
  p_org_id uuid,
  p_branch_id uuid,
  p_period_start date,
  p_period_end date
)
returns table (type_name text, total numeric)
language sql
stable
as $$
  select ct.name, sum(ci.total)
  from checkins c
  join compensation_items ci on ci.checkin_id = c.id
  join compensation_types ct on ct.id = ci.type_id
  where c.org_id = p_org_id
    and c.branch_id = p_branch_id
    and c.checkin_date >= p_period_start
    and c.checkin_date < p_period_end
  group by ct.name
$$;

-- Breakdown de la pérdida real por categoría de motivo en el período.
create function branch_reason_breakdown(
  p_org_id uuid,
  p_branch_id uuid,
  p_period_start date,
  p_period_end date
)
returns table (reason_category text, total numeric)
language sql
stable
as $$
  select ci.reason_category, sum(ci.total)
  from checkins c
  join compensation_items ci on ci.checkin_id = c.id
  where c.org_id = p_org_id
    and c.branch_id = p_branch_id
    and c.checkin_date >= p_period_start
    and c.checkin_date < p_period_end
  group by ci.reason_category
$$;
