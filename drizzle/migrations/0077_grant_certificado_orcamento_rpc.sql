REVOKE ALL ON FUNCTION public.certificado_reservar_orcamento_envio(date, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.certificado_reservar_orcamento_envio(date, numeric) TO service_role;