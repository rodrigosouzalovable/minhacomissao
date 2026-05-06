DO $$ BEGIN
  PERFORM cron.unschedule('aquecimento-auto-horario-economico');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('aquecimento-autosave-horario');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('aquecimento-promocao-fase-diaria');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

INSERT INTO public.whatsapp_aquecimento_config (chave, valor, descricao)
VALUES ('aquecimento_pausado', 'true'::jsonb, 'Pausa global do aquecimento entre números (ping-pong + autosave). Reativar quando estratégia de grupo único estiver pronta.')
ON CONFLICT (chave) DO UPDATE SET valor = 'true'::jsonb, updated_at = now();