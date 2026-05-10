
ALTER TABLE public.whatsapp_aquecimento_grupo_config
  ALTER COLUMN msgs_min_dia SET DEFAULT 6,
  ALTER COLUMN msgs_max_dia SET DEFAULT 12,
  ALTER COLUMN max_msgs_por_instancia_dia SET DEFAULT 3,
  ALTER COLUMN max_audios_por_instancia_dia SET DEFAULT 1,
  ALTER COLUMN max_imagens_por_instancia_dia SET DEFAULT 1,
  ALTER COLUMN carencia_horas SET DEFAULT 96;

UPDATE public.whatsapp_aquecimento_grupo_config
SET msgs_min_dia = 6,
    msgs_max_dia = 12,
    max_msgs_por_instancia_dia = 3,
    max_audios_por_instancia_dia = 1,
    max_imagens_por_instancia_dia = 1,
    carencia_horas = 96;
