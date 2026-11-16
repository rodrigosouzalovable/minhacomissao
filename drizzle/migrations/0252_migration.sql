UPDATE public.meta_whatsapp_contatos SET telefone = substr(telefone,3)
WHERE id IN ('4691788f-ce89-4787-8fa1-6e8fb6d67724','698dd367-166b-4719-a007-42f1dd210831') AND telefone LIKE '551%';
UPDATE public.meta_whatsapp_mensagens SET telefone = substr(telefone,3)
WHERE telefone IN ('5514077348291','5519787263892');