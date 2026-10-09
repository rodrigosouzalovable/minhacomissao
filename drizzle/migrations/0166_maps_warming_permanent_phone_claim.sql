CREATE TABLE public.meta_maps_aquecimento_consumidos (
 telefone_sufixo text PRIMARY KEY CHECK (telefone_sufixo ~ '^[0-9]{8}$'),
 primeiro_uso_em timestamptz NOT NULL DEFAULT now(),
 origem text NOT NULL,
 instancia_id uuid
);
GRANT ALL ON public.meta_maps_aquecimento_consumidos TO service_role;
ALTER TABLE public.meta_maps_aquecimento_consumidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY maps_consumidos_internal ON public.meta_maps_aquecimento_consumidos TO service_role USING (true) WITH CHECK (true);
INSERT INTO public.meta_maps_aquecimento_consumidos(telefone_sufixo,primeiro_uso_em,origem)
SELECT sufixo,min(em),'historico' FROM (
 SELECT right(regexp_replace(coalesce(telefone_internacional,telefone,''),'\D','','g'),8) sufixo,usado_aquecimento_em em FROM public.google_maps_leads WHERE usado_aquecimento_em IS NOT NULL
 UNION ALL SELECT right(regexp_replace(destino_telefone,'\D','','g'),8),enviado_em FROM public.meta_aquecimento_destino_log WHERE fonte IN ('lead','auto_respondedor') AND (status <> 'falha' OR wamid IS NOT NULL)
 UNION ALL SELECT telefone_sufixo,consumido_em FROM public.meta_recuperacao_cadastral_destinos WHERE fonte <> 'uazapi' AND consumido_em IS NOT NULL
) h WHERE sufixo ~ '^[0-9]{8}$' GROUP BY sufixo ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.reservar_maps_aquecimento_unico(p_instancia uuid,p_sufixo text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_owner uuid; v_id text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Acesso interno obrigatório'; END IF;
 IF p_sufixo IS NULL OR p_sufixo !~ '^[0-9]{8}$' THEN RETURN false; END IF;
 SELECT user_id INTO v_owner FROM public.meta_whatsapp_instances WHERE id=p_instancia AND ativo AND provider='meta';
 IF NOT FOUND THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.meta_recuperacao_cadastral_destinos d WHERE d.user_id=v_owner AND d.telefone_sufixo=p_sufixo AND d.fonte<>'uazapi' AND d.autorizado_em IS NOT NULL AND d.bloqueado_em IS NULL AND d.consumido_em IS NULL) THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.meta_destinatario_supressao s WHERE s.telefone_sufixo=p_sufixo) THEN RETURN false; END IF;
 INSERT INTO public.meta_maps_aquecimento_consumidos(telefone_sufixo,origem,instancia_id) VALUES(p_sufixo,'reserva',p_instancia) ON CONFLICT DO NOTHING RETURNING telefone_sufixo INTO v_id;
 RETURN v_id IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.reservar_maps_aquecimento_unico(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_maps_aquecimento_unico(uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.proteger_maps_reserva_cadastral()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.cadastral AND NEW.fonte<>'uazapi' AND NEW.status='reservado' THEN
   IF NOT public.reservar_maps_aquecimento_unico(NEW.instancia_id,NEW.telefone_sufixo) THEN
     RAISE EXCEPTION 'Destinatário já utilizado, sem autorização ou suprimido' USING ERRCODE='23505';
   END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.proteger_maps_reserva_cadastral() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER maps_cadastral_reserva_unica BEFORE INSERT ON public.meta_recuperacao_log FOR EACH ROW EXECUTE FUNCTION public.proteger_maps_reserva_cadastral();
COMMENT ON TABLE public.meta_maps_aquecimento_consumidos IS 'Permanent global suffix claim across Google Maps warming and cadastral recovery. Never release claims after transport uncertainty or elapsed days; opt-out remains separate.';