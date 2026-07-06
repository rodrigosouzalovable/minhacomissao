UPDATE public.meta_whatsapp_templates
SET variaveis = jsonb_set(
  COALESCE(variaveis, '{}'::jsonb),
  '{_header_image_url}',
  to_jsonb('https://cymdrkeukockakfzjeen.supabase.co/storage/v1/object/public/inbox-media/meta-templates/fd1dcae6-a1a8-4420-8c3c-b928ac3de07d/1783338234906.png'::text)
)
WHERE nome_template = 'solicitacao_de_renegociacao'
  AND idioma = 'pt_BR'
  AND (variaveis->>'_header_image_url' IS NULL OR variaveis->>'_header_image_url' = '');