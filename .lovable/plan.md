

## Corrigir verificação WhatsApp + Auto DDI 55 na importação

### Problema 1: Todos os números marcados como inválidos
A UAZAPI retorna `isInWhatsapp: true/false` mas o código verifica campos inexistentes (`exists`, `numberExists`, `status`, etc.). Resultado: **nenhum número é reconhecido como válido**.

Nos logs, o número `5561993243834` retornou `"isInWhatsapp": true` — mas o código não verifica esse campo.

### Problema 2: Timeouts com lotes de 50
Vários lotes retornaram `{"code":504,"message":"Request timeout"}`. Lotes de 50 são grandes demais para a UAZAPI.

### Problema 3: DDI 55 não adicionado na importação
Os telefones da planilha não recebem o prefixo 55 automaticamente.

### Correções

#### 1. Edge Function `check-whatsapp-numbers/index.ts`
- Adicionar `item.isInWhatsapp === true` na verificação (campo real da UAZAPI)
- Reduzir `BATCH_SIZE` de 50 para **10** para evitar timeouts
- Tratar resposta com `code: 504` como retry ou erro explícito
- Aumentar delay entre lotes para 1 segundo

#### 2. Importação no `Acionamento.tsx`
- No `handleFileUpload`, após limpar o telefone com `replace(/\D/g, '')`, adicionar DDI 55 se não começar com 55
- Mesma lógica para layout simples e padrão

#### 3. Importação no `CampanhasVoz.tsx`
- Mesma lógica de DDI 55 automático na importação de planilha

### Arquivos
1. **`supabase/functions/check-whatsapp-numbers/index.ts`** — corrigir campo `isInWhatsapp`, reduzir batch size
2. **`src/pages/Acionamento.tsx`** — auto DDI 55 na importação
3. **`src/pages/CampanhasVoz.tsx`** — auto DDI 55 na importação

