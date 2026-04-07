

## Plano: Sincronizar contagem de números no Aquecimento com status real de conexão

### Problema
A aba Aquecimento conta **todas** as linhas da tabela `user_whatsapp_instances` com `ativo=true` (49), mas na realidade apenas 46 estão conectadas ao WhatsApp. O campo `ativo` não é atualizado quando um número desconecta — ele continua `true`.

### Solução

**1. Usar a mesma lógica de conexão do Acionamento**

No `loadMetrics()` do `Aquecimento.tsx`, em vez de contar apenas `ativo=true`, verificar o status real de conexão das instâncias usando a API UAZAPI (mesmo mecanismo que o Acionamento usa via `checkInstanceConnections`).

Porém isso seria lento (chamada API por instância). A abordagem mais prática:

**Abordagem escolhida: Atualizar `ativo=false` quando desconectar**

Adicionar lógica para que, quando o sistema detecta uma instância desconectada (no Acionamento ou no ciclo de aquecimento), marque `ativo=false` na tabela `user_whatsapp_instances`. Isso mantém a contagem coerente em todas as páginas.

**2. Alterações no `src/pages/Aquecimento.tsx`**

- O card "Total Números" passa a refletir apenas instâncias que estão na tabela de aquecimento **e** existem em `user_whatsapp_instances` com `ativo=true` (join).
- Melhorar a query do `loadMetrics()` para cruzar com instâncias reais ativas.

**3. Limpeza automática na Edge Function `whatsapp-aquecimento`**

Adicionar ao início do ciclo de 15min:
- Verificar se cada instância em aquecimento ainda existe em `user_whatsapp_instances` com `ativo=true`
- Se não existe mais → atualizar status para `REMOVIDO` na tabela de aquecimento
- Isso garante que números desconectados/removidos saiam automaticamente do aquecimento

**4. Alterações no `src/pages/Acionamento.tsx`**

Quando `checkInstanceConnections` detectar uma instância desconectada, atualizar `ativo=false` no banco. Quando reconectar, voltar para `ativo=true`.

### Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Aquecimento.tsx` | `loadMetrics()` — contar apenas instâncias com correspondência ativa |
| `src/pages/Acionamento.tsx` | `checkInstanceConnections` — sincronizar `ativo` no banco |
| `supabase/functions/whatsapp-aquecimento/index.ts` | Limpeza de instâncias removidas no início do ciclo |

