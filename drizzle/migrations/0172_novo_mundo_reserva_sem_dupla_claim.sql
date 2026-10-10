CREATE OR REPLACE FUNCTION public.proteger_maps_reserva_cadastral()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
 IF NEW.cadastral AND NEW.fonte='novo_mundo' AND NEW.status='reservado' THEN
  IF auth.role() IS DISTINCT FROM 'service_role' OR NOT EXISTS (
   SELECT 1 FROM public.meta_novo_mundo_contatos c
   JOIN public.meta_novo_mundo_lotes b ON b.id=c.lote_id AND b.user_id=c.user_id
   JOIN public.meta_whatsapp_instances i ON i.id=NEW.instancia_id AND i.user_id=c.user_id
   JOIN public.meta_maps_aquecimento_consumidos u ON u.telefone_sufixo=c.telefone_sufixo AND u.instancia_id=i.id AND u.origem='novo_mundo'
   WHERE c.telefone_sufixo=NEW.telefone_sufixo AND c.telefone=NEW.destino_telefone
    AND c.estado='pendente' AND c.log_id IS NULL AND b.autorizado_em IS NOT NULL
    AND NEW.variaveis=jsonb_build_array(c.var1,c.var2)
    AND NOT EXISTS(SELECT 1 FROM public.meta_destinatario_supressao s WHERE s.telefone_sufixo=c.telefone_sufixo)
    AND NOT EXISTS(SELECT 1 FROM public.meta_recuperacao_log l WHERE l.cadastral AND l.telefone_sufixo=c.telefone_sufixo)
  ) THEN RAISE EXCEPTION 'Reserva Novo Mundo sem contato autorizado, inédita ou suprimida' USING ERRCODE='23505'; END IF;
 ELSIF NEW.cadastral AND NEW.fonte<>'uazapi' AND NEW.status='reservado' THEN
  IF NOT public.reservar_maps_aquecimento_unico(NEW.instancia_id,NEW.telefone_sufixo) THEN
   RAISE EXCEPTION 'Destinatário já utilizado, sem autorização ou suprimido' USING ERRCODE='23505';
  END IF;
 END IF;
 RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION public.proteger_maps_reserva_cadastral() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.proteger_maps_reserva_cadastral() TO service_role;