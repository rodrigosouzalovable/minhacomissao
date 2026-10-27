CREATE OR REPLACE FUNCTION public.acordos_normalizar_cliente()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE d text; t text;
BEGIN
  IF NEW.cliente_nome IS NOT NULL THEN
    NEW.cliente_nome := upper(regexp_replace(btrim(NEW.cliente_nome), '\s+', ' ', 'g'));
  END IF;
  IF NEW.cliente_cpf IS NOT NULL THEN
    d := regexp_replace(NEW.cliente_cpf, '\D', '', 'g');
    IF length(d) = 11 THEN
      NEW.cliente_cpf := substr(d,1,3)||'.'||substr(d,4,3)||'.'||substr(d,7,3)||'-'||substr(d,10,2);
    END IF;
  END IF;
  IF NEW.cliente_telefone IS NOT NULL THEN
    t := regexp_replace(NEW.cliente_telefone, '\D', '', 'g');
    IF length(t) IN (12,13) AND left(t,2) = '55' THEN t := substr(t,3); END IF;
    IF length(t) = 11 THEN
      NEW.cliente_telefone := '('||substr(t,1,2)||') '||substr(t,3,5)||'-'||substr(t,8,4);
    ELSIF length(t) = 10 THEN
      NEW.cliente_telefone := '('||substr(t,1,2)||') '||substr(t,3,4)||'-'||substr(t,7,4);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_acordos_normalizar_cliente ON public.acordos;
CREATE TRIGGER trg_acordos_normalizar_cliente
BEFORE INSERT OR UPDATE OF cliente_nome, cliente_cpf, cliente_telefone ON public.acordos
FOR EACH ROW EXECUTE FUNCTION public.acordos_normalizar_cliente();