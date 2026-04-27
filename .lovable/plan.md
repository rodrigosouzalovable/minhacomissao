## Problema

Os webhooks da UAZAPI estão sendo desativados sozinhos (toggle "Habilitado" OFF). Quando isso acontece, **nenhuma mensagem recebida chega no Inbox**, porque a UAZAPI deixa de chamar o webhook `whatsapp-chatbot`.

Hoje o botão "Pânico: Cortar Grupos" no Monitor de Envios chama `uazapi-disable-group-webhooks`, mas essa função **não envia o flag `enabled: true`** no payload — então em algumas versões da UAZAPI o webhook é recriado já desabilitado, exatamente como está acontecendo.

## Solução (manual, sem cron, sem custo extra)

### 1. Corrigir `uazapi-disable-group-webhooks`
Adicionar `enabled: true` no payload e um passo de **verificação pós-POST** (GET `/webhook`) com 1 retry caso o webhook volte desabilitado — mesma lógica resiliente já usada em `whatsapp-qr/reinforceWebhook`.

Resultado: o botão passa a garantir webhook **ativo + URL correta + grupos/broadcast bloqueados** numa única chamada.

### 2. Renomear/duplicar o botão no Monitor de Envios
No `MonitorEnvios.tsx`, manter o botão atual mas deixar claro que ele também **reativa** os webhooks desabilitados:

- Texto: **"Reconfigurar Webhooks de Todas as Instâncias"**
- Ícone: `Wrench` (chave inglesa) em vez de `ShieldAlert`
- Variante: `default` (azul) em vez de `destructive`
- Confirmação atualizada: "Reconfigurar e reativar o webhook de TODAS as instâncias UAZAPI? Isso restaura o recebimento de mensagens no Inbox e mantém grupos/broadcasts bloqueados."
- Toast: "X/Y instâncias reativadas. Z falharam."

O botão **"Diagnosticar Webhooks"** continua existindo do lado para você verificar antes/depois.

## Detalhes técnicos

**Arquivos modificados:**
- `supabase/functions/uazapi-disable-group-webhooks/index.ts`
  - Adicionar `enabled: true` no `restrictedPayload`
  - Após POST bem-sucedido, fazer GET `/webhook` para verificar `enabled === true`
  - Se vier `enabled: false`, fazer 1 retry de POST
  - Retornar `healthy_after` no JSON de resposta
- `src/pages/MonitorEnvios.tsx`
  - Renomear handler `handlePanicDisableGroups` → `handleReconfigureWebhooks`
  - Trocar texto, ícone, variante e mensagens do botão

**Sem alterações em:**
- Banco de dados (nenhuma migration)
- Cron / pg_cron (nada agendado)
- Outras edge functions

**Custo Lovable Cloud:** zero adicional. A função só roda quando você clicar no botão.
