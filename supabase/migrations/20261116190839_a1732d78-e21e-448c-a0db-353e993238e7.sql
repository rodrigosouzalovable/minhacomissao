-- Reabre conversas USA B2B encerradas apenas por resposta automática da empresa
update public.iago_conversa_estado e
set etapa = 'conversando', followup_feito = false
from public.meta_whatsapp_contatos c
where c.id = e.contato_id
  and c.folder_id = '7b3e9a10-4c2d-4f8e-9a61-0d5e2c8b1a47'
  and e.etapa = 'vendas_encerrado'
  and coalesce(e.optout, false) = false;