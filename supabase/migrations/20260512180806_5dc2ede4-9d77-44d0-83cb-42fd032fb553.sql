
create table if not exists public.marketbet_proxy_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  acao text not null,
  payload jsonb,
  resposta jsonb,
  sucesso boolean,
  criado_em timestamptz not null default now()
);

alter table public.marketbet_proxy_log enable row level security;

create policy "admin all marketbet_proxy_log"
on public.marketbet_proxy_log
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'::app_role))
with check (public.has_role(auth.uid(), 'admin'::app_role));

create table if not exists public.marketbet_proxies_gerados (
  id uuid primary key default gen_random_uuid(),
  proxy_string text not null,
  host text not null,
  porta integer not null,
  username text not null,
  password text not null,
  estado text,
  cidade text,
  tipo text default 'fixo',
  aplicado_em_instancia uuid references public.user_whatsapp_instances(id) on delete set null,
  aplicado_em timestamptz,
  criado_em timestamptz not null default now()
);

create index if not exists idx_mbp_gerados_aplicado on public.marketbet_proxies_gerados(aplicado_em_instancia);

alter table public.marketbet_proxies_gerados enable row level security;

create policy "admin all marketbet_proxies_gerados"
on public.marketbet_proxies_gerados
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'::app_role))
with check (public.has_role(auth.uid(), 'admin'::app_role));
