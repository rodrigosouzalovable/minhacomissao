CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  j jsonb;
BEGIN
  j := to_jsonb(NEW);
  IF j ? 'updated_at' THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object('updated_at', now()));
  ELSIF j ? 'atualizado_em' THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object('atualizado_em', now()));
  END IF;
  RETURN NEW;
END;
$function$;