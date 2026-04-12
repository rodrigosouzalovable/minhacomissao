

## Melhorias no Sistema de Aquecimento Multi-Instâncias

### 1. Pares Rotativos Inteligentes (evitar duplicação e garantir rotação)

**Problema atual:** Com 5 instâncias, cada uma escolhe um destino aleatório a cada ciclo. Isso causa conversas duplicadas (A→B e B→A ao mesmo tempo) e falta de rotação.

**Solução:** Implementar sistema de pares no `whatsapp-aquecimento`:
- A cada ciclo, gerar **pares únicos** em vez de cada instância agir independente
- Com 5 instâncias: gera 2 pares (A↔B, C↔D), 1 fica de fora e entra no próximo ciclo
- Usar um campo `ultimo_parceiro_id` na tabela `whatsapp_aquecimento_instancias` para evitar repetir o mesmo par no mesmo dia
- Algoritmo: shuffle das instâncias, formar pares em sequência, verificar cooldown de 2h entre mesmo par (já existe), pular pares que já conversaram hoje

**Arquivo:** `supabase/functions/whatsapp-aquecimento/index.ts`
- Substituir o loop "para cada instância, escolha destino aleatório" por um gerador de pares
- Cada par inicia apenas 1 conversa (não 2 — A inicia com B, B responde via cadeia)

#### Migration SQL
- Adicionar coluna `ultimo_parceiro_id` (uuid nullable) na tabela `whatsapp_aquecimento_instancias`

### 2. Limite Diário Real (contar trocas da cadeia, não apenas iniciações)

**Problema atual:** O `interacoes_hoje` conta apenas as *iniciações* de conversa. Uma conversa gera 12-18 mensagens via cadeia ping-pong, mas o contador fica em 1.

**Solução:**
- No `whatsapp-ia-responder`, na action `gerar-resposta`, incrementar `interacoes_hoje` da instância que está respondendo
- Definir limite diário de **15 mensagens totais** (enviadas + recebidas na cadeia)
- No `gerar-resposta`, antes de responder, verificar se a instância atingiu o limite. Se sim, finalizar a conversa

**Arquivo:** `supabase/functions/whatsapp-ia-responder/index.ts`
- Na action `gerar-resposta`, após o delay, buscar o registro da instância em `whatsapp_aquecimento_instancias`
- Se `interacoes_hoje >= 15`, marcar conversa como FINALIZADA e não responder
- Caso contrário, incrementar `interacoes_hoje` e `interacoes_total`

### 3. Log de Pares no Dashboard

**Solução:** Adicionar no dashboard existente uma seção "Conversas de Hoje" mostrando:
- Pares que conversaram (Nome A ↔ Nome B)
- Total de trocas de cada conversa
- Status (ATIVA, FINALIZADA)

**Arquivo:** `src/components/aquecimento/AquecimentoDashboard.tsx`
- Buscar `whatsapp_conversas_ia` do dia com status ATIVA ou FINALIZADA
- Exibir cards simples com origem ↔ destino, total_trocas/max_trocas, status

### Resumo de Arquivos
1. **SQL Migration** — adicionar `ultimo_parceiro_id` em `whatsapp_aquecimento_instancias`
2. **`supabase/functions/whatsapp-aquecimento/index.ts`** — sistema de pares rotativos
3. **`supabase/functions/whatsapp-ia-responder/index.ts`** — contagem real + limite na cadeia
4. **`src/components/aquecimento/AquecimentoDashboard.tsx`** — seção de conversas do dia

