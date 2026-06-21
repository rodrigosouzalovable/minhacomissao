UPDATE public.meta_whatsapp_templates
SET variaveis = COALESCE(variaveis, '{}'::jsonb) || jsonb_build_object(
  '_header_format', 'IMAGE',
  '_header_image_url', 'https://minhacomissao.lovable.app/__l5e/assets-v1/9c66231c-a0f5-4b67-b408-8088b33b005c/atualizacao-header.png'
)
WHERE nome_template = 'atualizacao';