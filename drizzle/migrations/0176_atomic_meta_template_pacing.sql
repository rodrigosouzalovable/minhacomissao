CREATE TABLE public.meta_template_pacing (
 scope_key text PRIMARY KEY,
 next_allowed_at timestamptz NOT NULL DEFAULT now(),
 lease_token uuid,
 lease_until timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.meta_template_pacing TO service_role;
ALTER TABLE public.meta_template_pacing ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_only ON public.meta_template_pacing FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE OR REPLACE FUNCTION public.claim_meta_template_pacing(p_instancia_id uuid, p_mestre_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i record; keys text[]; k text; blocked timestamptz; token uuid := gen_random_uuid(); cooldown timestamptz; bm_key text;
BEGIN
 SELECT id,user_id,waba_id,meta_bm_id,business_id INTO i FROM public.meta_whatsapp_instances WHERE id=p_instancia_id;
 IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.meta_templates_mestre WHERE id=p_mestre_id AND criado_por=i.user_id) THEN RAISE EXCEPTION 'unauthorized template instance'; END IF;
 bm_key := 'bm:' || i.user_id::text || ':' || coalesce(i.meta_bm_id::text,nullif(i.business_id,''),i.waba_id,i.id::text);
 keys := ARRAY['number:'||i.id::text,'waba:'||i.user_id::text||':'||coalesce(nullif(i.waba_id,''),i.id::text),bm_key];
 FOR k IN SELECT DISTINCT unnest(keys) ORDER BY 1 LOOP
   PERFORM pg_advisory_xact_lock(hashtextextended(k,0));
   INSERT INTO public.meta_template_pacing(scope_key) VALUES(k) ON CONFLICT DO NOTHING;
 END LOOP;
 SELECT max(CASE WHEN scope_key=bm_key THEN CASE WHEN lease_until>now() THEN lease_until ELSE now() END ELSE greatest(next_allowed_at,coalesce(lease_until,now())) END) INTO blocked FROM public.meta_template_pacing WHERE scope_key=ANY(keys);
 IF blocked>now() THEN RETURN jsonb_build_object('allowed',false,'next_allowed_at',blocked); END IF;
 IF EXISTS (SELECT 1 FROM public.meta_templates_instancia WHERE instancia_id=i.id AND template_mestre_id=p_mestre_id AND upper(status) IN ('APPROVED','PENDING','ENVIADO','IN_APPEAL','PENDING_DELETION')) THEN
   RETURN jsonb_build_object('allowed',false,'existing',true,'next_allowed_at',now());
 END IF;
 cooldown := now() + make_interval(secs => 120 + floor(random()*181)::integer);
 UPDATE public.meta_template_pacing SET next_allowed_at=CASE WHEN scope_key=bm_key THEN now() ELSE cooldown END,lease_token=token,lease_until=now()+interval '180 seconds',updated_at=now() WHERE scope_key=ANY(keys);
 RETURN jsonb_build_object('allowed',true,'token',token,'next_allowed_at',cooldown);
END $$;
REVOKE ALL ON FUNCTION public.claim_meta_template_pacing(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_meta_template_pacing(uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.finish_meta_template_pacing(p_token uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE public.meta_template_pacing SET lease_until=null,lease_token=null,updated_at=now() WHERE lease_token=p_token;
$$;
REVOKE ALL ON FUNCTION public.finish_meta_template_pacing(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_meta_template_pacing(uuid) TO service_role;
INSERT INTO public.meta_template_pacing(scope_key,next_allowed_at)
SELECT scope_key,max(last_send)+interval '300 seconds' FROM (
 SELECT 'number:'||f.instancia_id::text scope_key, max(f.enviado_em) last_send FROM public.meta_templates_onboarding_fila f WHERE f.enviado_em>now()-interval '5 minutes' GROUP BY f.instancia_id
 UNION ALL
 SELECT 'waba:'||i.user_id::text||':'||i.waba_id,max(f.enviado_em) FROM public.meta_templates_onboarding_fila f JOIN public.meta_whatsapp_instances i ON i.id=f.instancia_id WHERE f.enviado_em>now()-interval '5 minutes' AND i.waba_id IS NOT NULL GROUP BY i.user_id,i.waba_id
 UNION ALL
 SELECT 'number:'||t.instancia_id::text,max(t.atualizado_em) FROM public.meta_templates_instancia t WHERE t.atualizado_em>now()-interval '5 minutes' AND upper(t.status) IN ('PENDING','ENVIADO') GROUP BY t.instancia_id
 UNION ALL
 SELECT 'waba:'||i.user_id::text||':'||i.waba_id,max(t.atualizado_em) FROM public.meta_templates_instancia t JOIN public.meta_whatsapp_instances i ON i.id=t.instancia_id WHERE t.atualizado_em>now()-interval '5 minutes' AND upper(t.status) IN ('PENDING','ENVIADO') AND i.waba_id IS NOT NULL GROUP BY i.user_id,i.waba_id
) s GROUP BY scope_key ON CONFLICT DO NOTHING;
CREATE INDEX meta_template_pacing_lease_idx ON public.meta_template_pacing(lease_token) WHERE lease_token IS NOT NULL;