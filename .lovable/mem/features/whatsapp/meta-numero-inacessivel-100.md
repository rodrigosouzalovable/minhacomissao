---
name: Meta erro #100 número inacessível
description: Erro #100 da Graph (Unsupported post request / object does not exist) restringe a instância no pool, avisa admin 1x/dia e mostra explicação em português
type: feature
---

- Detecção centralizada em `supabase/functions/_shared/meta-numero-inacessivel.ts` (`ehNumeroInacessivel`, `tratarNumeroInacessivel`), usada por `send-whatsapp-meta`, `send-whatsapp-meta-text` e `send-whatsapp-meta-media`.
- Ao detectar: `estado_pool='restrita'`, `pausa_automatica_motivo='status=NUMERO_INACESSIVEL'`, pausa 24h e `notificarAdmin` idempotente por instância/dia.
- Significa que o número saiu do WABA, migrou de BM ou o token perdeu permissão — exige reconectar token/Phone Number ID.
- `src/lib/humanizarErroEnvio.ts` traduz o erro para o usuário leigo.
- Respostas manuais no Inbox (texto/mídia/template de reabertura) nunca são bloqueadas por qualidade YELLOW/RED — só por bloqueios reais da Meta.
