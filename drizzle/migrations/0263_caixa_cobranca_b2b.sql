insert into public.meta_inbox_folders (id, nome, cor, owner_id)
values ('c0b2a7e1-5d3f-4a8b-9c11-2e6f8d4b7a90', 'B2B COBRANÇA', '#16a34a', 'ee649720-b8ce-47a2-859e-100a3a9ae6bb')
on conflict (id) do nothing;

create table public.cobranca_b2b_leads (
  id uuid primary key default gen_random_uuid(),
  telefone text not null unique,
  nome text,
  cidade text,
  nicho text,
  place_id text,
  enviado_em timestamptz,
  job_id uuid,
  created_at timestamptz not null default now()
);
grant select on public.cobranca_b2b_leads to authenticated;
grant all on public.cobranca_b2b_leads to service_role;
alter table public.cobranca_b2b_leads enable row level security;
create policy "Admins veem leads cobranca b2b" on public.cobranca_b2b_leads
for select to authenticated using (public.has_role(auth.uid(), 'admin'));

update public.usa_b2b_config set ativo = false where id = true;