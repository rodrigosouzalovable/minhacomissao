-- Re-deduplicar usando ctid como desempate (cobre casos de criado_em idêntico)
DELETE FROM public.whatsapp_mensagens m
USING public.whatsapp_mensagens k
WHERE m.instancia_id = k.instancia_id
  AND m.whatsapp_msg_id = k.whatsapp_msg_id
  AND m.whatsapp_msg_id IS NOT NULL
  AND (m.criado_em > k.criado_em
       OR (m.criado_em = k.criado_em AND m.ctid > k.ctid));

-- Índice único parcial
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_mensagens_msgid_unique
  ON public.whatsapp_mensagens (instancia_id, whatsapp_msg_id)
  WHERE whatsapp_msg_id IS NOT NULL;