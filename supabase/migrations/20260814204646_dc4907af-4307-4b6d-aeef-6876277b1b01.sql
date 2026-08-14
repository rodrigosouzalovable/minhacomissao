INSERT INTO public.admin_notificacoes_log (tipo, chave_idempotencia, mensagem, status)
SELECT 'iago_humano_painel',
       'backfill:' || md5(regexp_replace(l.mensagem, '^\[\d+\]\s*', '')),
       regexp_replace(l.mensagem, '^\[\d+\]\s*', ''),
       'interno'
FROM public.admin_notificacoes_log l
WHERE l.tipo = 'iago_humano'
  AND l.enviado_em > now() - interval '2 days'
GROUP BY regexp_replace(l.mensagem, '^\[\d+\]\s*', ''), l.mensagem
ON CONFLICT DO NOTHING;