CREATE OR REPLACE FUNCTION public.ativar_recuperacao_cadastral_autorizada(p_owner uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Acesso administrativo obrigatório'; END IF;
 IF p_owner IS DISTINCT FROM 'ee649720-b8ce-47a2-859e-100a3a9ae6bb'::uuid THEN RAISE EXCEPTION 'Proprietário não autorizado para este fluxo'; END IF;
 UPDATE public.meta_recuperacao_cadastral_config SET ativo=true,custo_autorizado_em=now(),custo_autorizado_por=auth.uid(),custo_limite_diario_brl=20.30 WHERE user_id=p_owner;
 IF NOT FOUND THEN RAISE EXCEPTION 'Configuração de recuperação ausente'; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.ativar_recuperacao_cadastral_autorizada(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ativar_recuperacao_cadastral_autorizada(uuid) TO authenticated;
