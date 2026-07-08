## O que "Falhou" significa

Falhou = a Meta rejeitou aquela mensagem específica. Nem sempre é banimento do chip — pode ser: número inválido / sem WhatsApp, janela de 24h expirada, template pausado/rejeitado, limite de qualidade do número, política de mensagens, ou, sim, restrição/pausa/banimento do número.

Hoje o webhook até recebe o motivo (título + código) da Meta, mas só grava esse texto na tabela do inbox — na tabela usada pelo painel "Envio Meta (massa)" (`meta_whatsapp_envios_log`) o campo `erro` fica vazio. Por isso o tooltip do "Falhou" aparece sem explicação.

## Correção 1 — mostrar o motivo ao lado de "Falhou"

**Backend (`supabase/functions/meta-whatsapp-webhook/index.ts`)**
- Quando `status === 'failed'` chega no webhook, gravar também `erro: <título + código>` no `UPDATE` de `meta_whatsapp_envios_log` (hoje só o `status` é atualizado).

**Frontend (`src/pages/EnvioMeta.tsx` + `EnvioMetaSendingContext.tsx`)**
- No card "Enviados", ao lado do badge "Falhou", exibir o texto do erro em vermelho pequeno (não só como tooltip).
- Já existe `deliveryErro` no contexto — só passar adiante e renderizar.

## Correção 2 — WhatsApp de aviso no fim do lote

**Backend (`supabase/functions/envio-meta-massa-tick/index.ts`)**
Quando o job passa para `concluido` (todos processados) ou `erro` (encerrado por falta de instância), disparar `notificarAdmin` (helper já existente que envia para 62991672674) com:

- Total enviados, erros, sem WhatsApp.
- Template e horário de início/fim.
- Instâncias que ficaram `estado_pool = 'restrita'` durante a janela do job (consulta `meta_whatsapp_instances` por `pausa_automatica_ate > iniciado_em` do job) — listando nome/número e motivo.
- Idempotência com chave `envio_meta_job_concluido_<job_id>` para não duplicar avisos.

Exemplo de mensagem:
```
✅ Envio Meta concluído
Template: {nome}
Total: 257 · Enviados: 210 · Falharam: 47

⚠️ Instâncias restringidas durante o envio:
- {nome} ({fone}) — Restrição Meta #131049
```

Se nenhuma instância foi restringida, a linha final vira "Nenhuma instância restringida.".

## Escopo excluído
- Sem novas tabelas ou colunas — reaproveita `erro` de `meta_whatsapp_envios_log` e `estado_pool`/`pausa_automatica_motivo` das instâncias.
- Sem mudança no rodízio/pool ou nas regras de envio.
- Sem mudança na UI dos cards "Erros no envio" (esses já mostram o erro; foco é o "Falhou" dentro de "Enviados").
