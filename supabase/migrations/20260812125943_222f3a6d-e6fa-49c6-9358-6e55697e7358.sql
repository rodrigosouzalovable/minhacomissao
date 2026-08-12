create or replace function public.envio_meta_job_delivery_resumo(_job_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _job public.envio_meta_job;
  _res jsonb;
begin
  select * into _job from public.envio_meta_job where id = _job_id;
  if _job.id is null then
    return jsonb_build_object('aceito',0,'entregue',0,'lida',0,'falhou',0,'aguardando',0);
  end if;

  if _job.user_id is distinct from auth.uid() and not public.has_role(auth.uid(), 'admin') then
    raise exception 'nao autorizado';
  end if;

  with itens as (
    select id, telefone, wa_message_id
    from public.envio_meta_job_item
    where job_id = _job_id and status = 'enviado'
  ),
  best as (
    select i.id,
      coalesce(max(
        case lower(coalesce(l.status, ''))
          when 'read' then 3
          when 'delivered' then 2
          when 'failed' then 4
          when 'sent' then 1
          when 'replied' then 1
          else 0
        end
      ), 0) as rank
    from itens i
    left join public.meta_whatsapp_envios_log l
      on (
        (i.wa_message_id is not null and l.wa_message_id = i.wa_message_id)
        or (
          i.wa_message_id is null
          and l.telefone = i.telefone
          and l.user_id = _job.user_id
          and l.enviado_em >= coalesce(_job.iniciado_em, now() - interval '7 days')
        )
      )
    group by i.id
  )
  select jsonb_build_object(
    'aceito', count(*) filter (where rank = 1),
    'entregue', count(*) filter (where rank = 2),
    'lida', count(*) filter (where rank = 3),
    'falhou', count(*) filter (where rank = 4),
    'aguardando', count(*) filter (where rank = 0)
  ) into _res
  from best;

  return coalesce(_res, jsonb_build_object('aceito',0,'entregue',0,'lida',0,'falhou',0,'aguardando',0));
end;
$$;

grant execute on function public.envio_meta_job_delivery_resumo(uuid) to authenticated;
grant execute on function public.envio_meta_job_delivery_resumo(uuid) to service_role;