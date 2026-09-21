CREATE OR REPLACE FUNCTION public.definir_instancia_notificacao_uazapi(
  p_instancia_id uuid,
  p_ativa boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar o remetente de notificações';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_whatsapp_instances WHERE id = p_instancia_id
  ) THEN
    RAISE EXCEPTION 'Instância não encontrada';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('admin_notificacao_instancia_exclusiva'));

  IF p_ativa THEN
    UPDATE public.admin_notificacao_instancias
       SET ativa = false, ativada_por = auth.uid(), atualizada_em = now()
     WHERE ativa = true AND instancia_id <> p_instancia_id;
  END IF;

  INSERT INTO public.admin_notificacao_instancias (instancia_id, ativa, ativada_por, atualizada_em)
  VALUES (p_instancia_id, p_ativa, auth.uid(), now())
  ON CONFLICT (instancia_id) DO UPDATE
    SET ativa = EXCLUDED.ativa, ativada_por = EXCLUDED.ativada_por, atualizada_em = now();

  UPDATE public.admin_notificacoes_config
     SET instancia_notificacao_id = CASE WHEN p_ativa THEN p_instancia_id ELSE NULL END,
         ultima_instancia_id = CASE WHEN p_ativa THEN p_instancia_id ELSE ultima_instancia_id END,
         updated_at = now()
   WHERE id = 1 AND (p_ativa OR instancia_notificacao_id = p_instancia_id);

  INSERT INTO public.admin_notificacao_instancias_auditoria (instancia_id, ativa, alterada_por)
  VALUES (p_instancia_id, p_ativa, auth.uid());

  RETURN p_ativa;
END;
$function$;

REVOKE ALL ON FUNCTION public.definir_instancia_notificacao_uazapi(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_instancia_notificacao_uazapi(uuid, boolean) TO authenticated, service_role;