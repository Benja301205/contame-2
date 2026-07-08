-- Loop 5: funciones de agregación para el dashboard de patrones.
-- Son funciones (no vistas) porque el filtro de período (30/90/180 días)
-- es dinámico. No llevan `security definer`: corren con los privilegios de
-- quien las llama, así que la RLS de `reviews`/`review_analysis` ya las
-- acota (un manager solo ve datos de sus sucursales asignadas, igual que
-- si hiciera la query directo).

create index reviews_org_date_idx on reviews (org_id, review_date);

-- Rating promedio y volumen por sucursal en una ventana [start, end).
-- Se llama dos veces desde la app (período actual y período anterior de
-- igual longitud) para calcular la tendencia en el cliente/servidor.
create function branch_rating_summary(p_org_id uuid, p_start date, p_end date)
returns table (branch_id uuid, avg_rating numeric, review_count bigint)
language sql
stable
as $$
  select branch_id, avg(rating)::numeric(10, 2), count(*)
  from reviews
  where org_id = p_org_id and review_date >= p_start and review_date < p_end
  group by branch_id
$$;

-- Evolución mensual de rating y volumen para una sucursal (detalle de sucursal).
create function branch_rating_monthly(p_org_id uuid, p_branch_id uuid, p_since date)
returns table (month date, avg_rating numeric, review_count bigint)
language sql
stable
as $$
  select date_trunc('month', review_date)::date as month, avg(rating)::numeric(10, 2), count(*)
  from reviews
  where org_id = p_org_id and branch_id = p_branch_id and review_date >= p_since
  group by 1
  order by 1
$$;

-- Frecuencia de cada categoría de problema por sucursal, en el período
-- actual y en el período anterior de igual longitud (para tendencia).
-- Alimenta el Top 5 por sucursal y el heatmap sucursal × categoría.
create function branch_category_stats(
  p_org_id uuid,
  p_current_start date,
  p_current_end date,
  p_previous_start date,
  p_previous_end date
)
returns table (branch_id uuid, category text, current_count bigint, previous_count bigint)
language sql
stable
as $$
  select
    r.branch_id,
    cat as category,
    count(*) filter (where r.review_date >= p_current_start and r.review_date < p_current_end) as current_count,
    count(*) filter (where r.review_date >= p_previous_start and r.review_date < p_previous_end) as previous_count
  from reviews r
  join review_analysis ra on ra.review_id = r.id
  cross join lateral unnest(ra.categories) as cat
  where r.org_id = p_org_id
    and r.review_date >= p_previous_start
    and r.review_date < p_current_end
  group by r.branch_id, cat
$$;

-- Breakdown por severidad (1-3) para una sucursal en una ventana.
create function branch_severity_breakdown(p_org_id uuid, p_branch_id uuid, p_start date, p_end date)
returns table (severity int, review_count bigint)
language sql
stable
as $$
  select ra.severity, count(*)
  from reviews r
  join review_analysis ra on ra.review_id = r.id
  where r.org_id = p_org_id
    and r.branch_id = p_branch_id
    and r.review_date >= p_start
    and r.review_date < p_end
  group by ra.severity
  order by ra.severity
$$;

-- Distribución de sentimiento a nivel organización en una ventana.
create function org_sentiment_distribution(p_org_id uuid, p_start date, p_end date)
returns table (sentiment text, review_count bigint)
language sql
stable
as $$
  select ra.sentiment, count(*)
  from reviews r
  join review_analysis ra on ra.review_id = r.id
  where r.org_id = p_org_id
    and r.review_date >= p_start
    and r.review_date < p_end
  group by ra.sentiment
$$;
