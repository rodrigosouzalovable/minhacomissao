create or replace function public.ume_vencimento_mais_antigo(p_cpf text)
returns date language sql stable security definer set search_path = public as $$
  select min(vencimento)::date from public.ume_carteira_parcelas
  where auth.uid() is not null
    and cpf in (regexp_replace(p_cpf,'\D','','g'),
      regexp_replace(regexp_replace(p_cpf,'\D','','g'),'^(\d{3})(\d{3})(\d{3})(\d{2})$','\1.\2.\3-\4'));
$$;
revoke all on function public.ume_vencimento_mais_antigo(text) from public, anon;
grant execute on function public.ume_vencimento_mais_antigo(text) to authenticated;
create index if not exists idx_ume_carteira_parcelas_cpf_venc on public.ume_carteira_parcelas (cpf, vencimento);