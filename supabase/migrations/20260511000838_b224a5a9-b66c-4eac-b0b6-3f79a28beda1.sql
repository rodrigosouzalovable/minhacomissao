
-- Calendário de comportamento do aquecimento por dia da semana
CREATE TABLE IF NOT EXISTS public.whatsapp_aquecimento_calendario (
  dia_semana INTEGER PRIMARY KEY CHECK (dia_semana BETWEEN 0 AND 6),
  horario_inicio TIME NOT NULL,
  horario_fim TIME NOT NULL,
  pausa_inicio TIME,
  pausa_fim TIME,
  fator_volume NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  quantidade_status INTEGER NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_aquecimento_calendario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam calendario aquecimento"
  ON public.whatsapp_aquecimento_calendario FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated leem calendario aquecimento"
  ON public.whatsapp_aquecimento_calendario FOR SELECT
  TO authenticated
  USING (true);

-- Valores iniciais (preserva comportamento atual)
INSERT INTO public.whatsapp_aquecimento_calendario
  (dia_semana, horario_inicio, horario_fim, pausa_inicio, pausa_fim, fator_volume, quantidade_status)
VALUES
  (0, '09:00', '18:00', NULL, NULL, 0.40, 0),
  (1, '07:00', '21:00', '12:00', '14:00', 1.00, 1),
  (2, '07:00', '21:00', '12:00', '14:00', 1.00, 1),
  (3, '07:00', '21:00', '12:00', '14:00', 1.00, 1),
  (4, '07:00', '21:00', '12:00', '14:00', 1.00, 1),
  (5, '08:00', '22:00', '12:00', '14:00', 1.10, 2),
  (6, '09:00', '18:00', NULL, NULL, 0.60, 1)
ON CONFLICT (dia_semana) DO NOTHING;

-- Personalidade dos chips
DO $$ BEGIN
  CREATE TYPE personalidade_chip AS ENUM ('rapido','equilibrado','reflexivo','noturno');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.user_whatsapp_instances
  ADD COLUMN IF NOT EXISTS personalidade personalidade_chip DEFAULT 'equilibrado';

UPDATE public.user_whatsapp_instances
SET personalidade = (ARRAY['rapido','equilibrado','reflexivo','noturno']::personalidade_chip[])[1 + floor(random()*4)::int]
WHERE personalidade IS NULL OR personalidade = 'equilibrado';
