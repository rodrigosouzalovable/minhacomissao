REVOKE ALL ON FUNCTION public.registrar_ciclo_qualidade_meta() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_ciclo_qualidade_meta() FROM anon;
REVOKE ALL ON FUNCTION public.registrar_ciclo_qualidade_meta() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_ciclo_qualidade_meta() TO service_role;

REVOKE ALL ON FUNCTION public.registrar_envio_ciclo_recuperacao_meta() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_envio_ciclo_recuperacao_meta() FROM anon;
REVOKE ALL ON FUNCTION public.registrar_envio_ciclo_recuperacao_meta() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_envio_ciclo_recuperacao_meta() TO service_role;