-- Loop 3: análisis de reviews con Claude API (review_analysis).

create table review_analysis (
  review_id uuid primary key references reviews (id) on delete cascade,
  sentiment text not null check (sentiment in ('positive', 'neutral', 'negative')),
  categories text[] not null default '{}',
  severity int not null check (severity between 1 and 3),
  mentions_compensation boolean not null default false,
  summary text,
  model text,
  analyzed_at timestamptz not null default now()
);

-- security definer: review_analysis no tiene org_id/branch_id propios (su PK
-- es review_id), así que para aplicar RLS necesitamos cruzar con reviews sin
-- disparar la RLS de reviews (mismo motivo que las funciones de branches del
-- Loop 1: evitar "infinite recursion detected in policy").
create function get_review_org_id(target_review_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select org_id from reviews where id = target_review_id
$$;

create function get_review_branch_id(target_review_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select branch_id from reviews where id = target_review_id
$$;

alter table review_analysis enable row level security;

create policy "review_analysis: select propia org"
  on review_analysis for select
  using (
    get_review_org_id(review_analysis.review_id) = get_user_org_id()
    and (
      get_user_role() = 'admin'
      or is_manager_of_branch(get_review_branch_id(review_analysis.review_id))
    )
  );
