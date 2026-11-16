-- Libera a trava diária deixada pelo piloto USA B2B enviado com +55 indevido e devolve os itens do reenvio à fila
delete from public.meta_envio_diario_telefone d
using public.envio_meta_job_item i
where i.job_id = '8a9344bc-bdcc-418b-a936-b03d09ed395f'
  and d.sufixo = right(regexp_replace(i.telefone,'\D','','g'),8)
  and d.dia = (now() at time zone 'America/Sao_Paulo')::date;

update public.envio_meta_job_item
set status = 'pendente', erro = null, tentativas = 0
where job_id = '2d41d658-3cbe-472d-91cd-107f382bb9d3'
  and status = 'erro' and erro like 'Telefone já recebeu mensagem hoje%';

update public.envio_meta_job
set erros = 0, status = 'rodando', concluido_em = null
where id = '2d41d658-3cbe-472d-91cd-107f382bb9d3';