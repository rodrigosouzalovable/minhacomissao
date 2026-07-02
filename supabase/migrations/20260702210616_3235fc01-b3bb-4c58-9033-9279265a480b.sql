
ALTER TABLE public.devedores
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in_em timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in_origem text;

ALTER TABLE public.acordos
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in_em timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in_origem text;

-- Trigger: ao criar/ativar acordo, propaga opt-in para o devedor
CREATE OR REPLACE FUNCTION public.propagar_opt_in_acordo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cliente_cpf IS NULL THEN RETURN NEW; END IF;

  -- Marca o próprio acordo
  IF NEW.whatsapp_opt_in IS NOT TRUE THEN
    NEW.whatsapp_opt_in := true;
    NEW.whatsapp_opt_in_em := COALESCE(NEW.whatsapp_opt_in_em, now());
    NEW.whatsapp_opt_in_origem := COALESCE(NEW.whatsapp_opt_in_origem, 'acordo_assinado');
  END IF;

  -- Propaga para devedores com mesmo CPF
  UPDATE public.devedores
     SET whatsapp_opt_in = true,
         whatsapp_opt_in_em = COALESCE(whatsapp_opt_in_em, now()),
         whatsapp_opt_in_origem = COALESCE(whatsapp_opt_in_origem, 'acordo_assinado')
   WHERE cpf_normalize(cpf) = cpf_normalize(NEW.cliente_cpf)
     AND whatsapp_opt_in = false;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagar_opt_in_acordo ON public.acordos;
CREATE TRIGGER trg_propagar_opt_in_acordo
  BEFORE INSERT ON public.acordos
  FOR EACH ROW
  EXECUTE FUNCTION public.propagar_opt_in_acordo();

-- Backfill: acordos já existentes contam como opt-in (cliente assinou)
UPDATE public.acordos
   SET whatsapp_opt_in = true,
       whatsapp_opt_in_em = COALESCE(whatsapp_opt_in_em, criado_em, now()),
       whatsapp_opt_in_origem = COALESCE(whatsapp_opt_in_origem, 'acordo_assinado')
 WHERE whatsapp_opt_in = false;

UPDATE public.devedores d
   SET whatsapp_opt_in = true,
       whatsapp_opt_in_em = COALESCE(d.whatsapp_opt_in_em, now()),
       whatsapp_opt_in_origem = COALESCE(d.whatsapp_opt_in_origem, 'acordo_assinado')
 WHERE d.whatsapp_opt_in = false
   AND EXISTS (
     SELECT 1 FROM public.acordos a
      WHERE cpf_normalize(a.cliente_cpf) = cpf_normalize(d.cpf)
   );
