insert into public.meta_whatsapp_contatos
  (user_id, instancia_id, telefone, telefone_visivel, nome, ultima_mensagem, ultima_mensagem_em, ultima_msg_entrada_em, arquivado, fixado, nao_lido, folder_id)
select
  m.user_id,
  m.instancia_id,
  m.telefone,
  true,
  null,
  (array_agg(m.conteudo order by m.timestamp_msg desc))[1],
  max(m.timestamp_msg),
  max(m.timestamp_msg) filter (where m.direcao = 'entrada'),
  false,
  false,
  0,
  null
from public.meta_whatsapp_mensagens m
where m.telefone is not null
  and exists (
    select 1 from public.meta_whatsapp_mensagens m2
    where m2.instancia_id = m.instancia_id and m2.telefone = m.telefone and m2.direcao = 'entrada'
  )
  and not exists (
    select 1 from public.meta_whatsapp_contatos c
    where c.instancia_id = m.instancia_id
      and right(regexp_replace(c.telefone, '\D', '', 'g'), 8) = right(regexp_replace(m.telefone, '\D', '', 'g'), 8)
  )
group by m.user_id, m.instancia_id, m.telefone;

create policy "meta_contatos_delete_admin_sem_resposta"
  on public.meta_whatsapp_contatos
  as restrictive
  for delete
  to authenticated
  using (public.is_admin_user(auth.uid()) and ultima_msg_entrada_em is null);