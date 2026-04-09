

## Diagnóstico Completo do Aquecimento

### Problemas Identificados

**Problema 1: Webhooks não reconfigurados no modo automático**
A reconfiguração dos webhooks (removendo o filtro `wasSentByApi`) só acontece no **teste manual** (linhas 169-195 do `whatsapp-aquecimento`). No modo automático (cron), os webhooks permanecem com o filtro ativo. Quando a instância A envia uma mensagem via API para B, o UAZAPI de B ignora essa mensagem porque `wasSentByApi: true` está nos `excludeMessages`. Resultado: o `whatsapp-chatbot` nunca recebe o webhook e a IA nunca é acionada.

**Problema 2: Query de detecção invertida no chatbot**
No `whatsapp-chatbot` (linha 1274-1282), a query busca `instancia_destino_id = senderInstance.id`. Mas quando A envia para B, o registro tem `instancia_destino_id = B`. Quando B recebe e o webhook dispara, `senderInstance` = A. A query busca `destino = A`, mas o registro tem `destino = B`. Nunca encontra match.

**Problema 3: Ausência de status postados**
O sistema postou 0 status hoje, provavelmente porque a função `shouldPostStatus` usa probabilidades muito baixas (1-3.5% por ciclo) e cada ciclo processa apenas 1 instância aleatória, combinado com o jitter de 0-180s.

### Plano de Correção

**1. Reconfigurar webhooks automaticamente (whatsapp-aquecimento)**
- Antes de enviar mensagens no modo automático, verificar se o webhook da instância destino já foi configurado hoje
- Usar uma flag em `whatsapp_aquecimento_instancias` (ex: `webhook_configurado_em`) ou simplesmente reconfigurar o webhook da instância destino antes de cada envio
- Reutilizar a mesma lógica do teste manual (3 endpoints fallback)

**2. Corrigir query de detecção no whatsapp-chatbot**
- Linha 1277: trocar de `instancia_destino_id = senderInstance.id` para buscar a interação correta:
  - Buscar onde `instancia_origem_id = senderInstance.id` (A enviou) E `instancia_destino_id = instanciaId` (B recebeu)
  - OU simplesmente `instancia_destino_id = instanciaId` (a instância que está no webhook é a que recebeu)

**3. Aumentar probabilidade de status**
- Aumentar `shouldPostStatus` de 1-3.5% para 5-8% para garantir ao menos 1 status por instância por dia

### Arquivos Afetados
- `supabase/functions/whatsapp-aquecimento/index.ts` — adicionar reconfiguração de webhook no modo automático
- `supabase/functions/whatsapp-chatbot/index.ts` — corrigir query de detecção de interações de aquecimento

