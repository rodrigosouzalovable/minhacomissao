## Diagnóstico

O envio da funcionária **foi para a Meta** (recebeu `wa_message_id`), por isso o diálogo mostrou "enviado". Mas a Meta rejeitou a entrega e o webhook trouxe o erro:

- `meta_whatsapp_mensagens.erro = "Business Account locked"`
- `status_envio = 'erro'` (relógio vermelho no inbox)

Ou seja, a **conta/instância Meta está bloqueada** (restringida). Hoje esse retorno assíncrono nunca chega até quem enviou — o funcionário só vê o balão azul e o clock vermelho, sem entender que a instância está bloqueada.

## Correções

### 1. `supabase/functions/meta-whatsapp-webhook/index.ts`
Ao processar `statuses[]` com `status === 'failed'`, quando o `errors[0]` indicar bloqueio/restrição/banimento (códigos Meta `131031`, `131049`, `368`, `130429` ou título/mensagem contendo `locked`, `restricted`, `banned`, `disabled`):
- Atualizar a `meta_whatsapp_instances` correspondente:
  - `estado_pool = 'restrita'`
  - `pausa_automatica_ate = now() + 24h`
  - `pausa_automatica_motivo = <título do erro Meta>`
- Chamar `notificarAdmin` (idempotente por instância+dia) avisando que a instância está restringida.

### 2. `supabase/functions/send-whatsapp-meta/index.ts`
Em `sendOne`, quando a Meta responder com erro síncrono indicando bloqueio (mesmos códigos/mensagens acima), retornar resposta 200 estruturada:
```json
{ "success": false, "instance_restricted": true, "error": "Instância restringida pela Meta: <detalhe>", "instancia_id": "..." }
```
em vez de deixar propagar como erro genérico. Também aplicar a mesma pausa automática na instância antes de retornar.

### 3. `src/components/inbox/meta/MetaNovaConversaDialog.tsx`
- Ao receber resposta com `data.instance_restricted`, `data.pool_blocked` ou `data.pool_paused`, exibir toast destrutivo com duração maior (~10s) e mensagem clara:
  > "A instância selecionada está restringida/banida pela Meta e não pode enviar mensagens. Escolha outra instância ou avise o administrador."
- Após envio bem-sucedido (com `waId`), fazer um pequeno polling (~12s, 3 checagens) em `meta_whatsapp_mensagens` filtrando por `wa_message_id`. Se `status_envio` virar `'erro'`, exibir toast destrutivo com o campo `erro` da mensagem (ex.: "Business Account locked — a instância está bloqueada pela Meta").

### 4. Painel/Envio Meta massa (`src/components/meta/*`) — apenas leitura visual
Como `estado_pool = 'restrita'` já bloqueia a instância na função de envio, nenhuma mudança extra é necessária no envio em massa; o guard já retorna `pool_blocked:true`.

## Fora de escopo
- Não altera lógica de renderização/preview (já corrigida na tarefa anterior).
- Não muda RLS nem permissões — a solução funciona igual para admin e funcionário.
- Não desativa a instância (`ativo=false`); apenas marca `estado_pool='restrita'` com pausa automática, permitindo que o admin destrave depois.

## Observação sobre a conta atual
A instância usada pela funcionária está com **Business Account locked** na Meta. Mesmo após o deploy do código, essa conta específica só voltará a enviar depois que o bloqueio for resolvido no Business Manager da Meta.
