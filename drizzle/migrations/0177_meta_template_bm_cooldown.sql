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
 SELECT max(greatest(next_allowed_at,coalesce(lease_until,now()))) INTO blocked FROM public.meta_template_pacing WHERE scope_key=ANY(keys);
 IF blocked>now() THEN RETURN jsonb_build_object('allowed',false,'next_allowed_at',blocked); END IF;
 IF EXISTS (SELECT 1 FROM public.meta_templates_instancia WHERE instancia_id=i.id AND template_mestre_id=p_mestre_id AND upper(status) IN ('APPROVED','PENDING','ENVIADO','IN_APPEAL','PENDING_DELETION')) THEN
   RETURN jsonb_build_object('allowed',false,'existing',true,'next_allowed_at',now());
 END IF;
 cooldown := now() + make_interval(secs => 120 + floor(random()*181)::integer);
 UPDATE public.meta_template_pacing SET next_allowed_at=cooldown,lease_token=token,lease_until=now()+interval '180 seconds',updated_at=now() WHERE scope_key=ANY(keys);
 RETURN jsonb_build_object('allowed',true,'token',token,'next_allowed_at',cooldown);
END $$;
REVOKE ALL ON FUNCTION public.claim_meta_template_pacing(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_meta_template_pacing(uuid,uuid) TO service_role;
COMMENT ON FUNCTION public.claim_meta_template_pacing(uuid,uuid) IS 'Shared atomic 120–300 second cooldown across number, WABA and entire owner-scoped BM; completion releases leases but never the cooldown. Applies to manual and queued submissions 24/7.';