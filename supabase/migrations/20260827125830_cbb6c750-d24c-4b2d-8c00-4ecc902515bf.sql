DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT ce.contato_id, ce.etiqueta_id
    FROM public.meta_whatsapp_contato_etiquetas ce
    JOIN public.meta_whatsapp_etiquetas e ON e.id = ce.etiqueta_id
    JOIN public.meta_whatsapp_contatos c ON c.id = ce.contato_id
    JOIN public.profiles p ON lower(btrim(e.nome)) = lower('Atendente: ' || btrim(p.nome))
    WHERE ce.origem = 'auto_atendente'
      AND e.nome ILIKE 'Atendente:%'
      AND c.folder_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.meta_inbox_folder_members m
        WHERE m.folder_id = c.folder_id AND m.user_id = p.id AND COALESCE(m.admin, false) = true
      )
      AND EXISTS (
        SELECT 1 FROM public.meta_inbox_folder_members m2
        WHERE m2.folder_id = c.folder_id AND COALESCE(m2.admin, false) = false
      )
  LOOP
    DELETE FROM public.meta_whatsapp_contato_etiquetas
    WHERE contato_id = r.contato_id AND etiqueta_id = r.etiqueta_id;

    PERFORM public.atribuir_atendente_rodizio(r.contato_id);
  END LOOP;
END $$;