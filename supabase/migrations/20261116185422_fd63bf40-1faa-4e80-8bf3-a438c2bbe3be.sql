-- Remove supressões "sem WhatsApp" geradas pelo envio piloto USA B2B que saiu com +55 indevido
delete from public.meta_destinatario_supressao s
using public.envio_meta_job_item i
where i.job_id = '8a9344bc-bdcc-418b-a936-b03d09ed395f'
  and s.telefone_sufixo = right(regexp_replace(i.telefone,'\D','','g'),8)
  and s.categoria = 'sem_whatsapp';