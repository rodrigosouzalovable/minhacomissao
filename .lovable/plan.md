# Por que o "oi" não apareceu no Inbox

A mensagem **foi enviada e salva** no banco — só foi parar numa conversa "fantasma" porque a UAZAPI devolveu o seu número **sem o "9"** do celular (`556291672674` em vez de `5562991672674`).

O Inbox lista conversas pelo telefone exato, então criou um chat separado de 12 dígitos que você não está olhando. Esse problema vem se repetindo há semanas — a maior parte do seu histórico está com 12 dígitos e algumas mensagens com 13 dígitos, em conversas separadas.

# Correção (2 partes)

## Parte 1 — Normalizar telefone ao salvar (consertar o bug daqui pra frente)

No `supabase/functions/send-whatsapp/index.ts`, antes de gravar em `whatsapp_mensagens`, aplicar normalização brasileira: se o número tem 12 dígitos começando com `55` + DDD, adicionar o "9" e salvar a forma canônica de 13 dígitos. Mesmo tratamento no `whatsapp-chatbot` (mensagens recebidas) para garantir que entrada e saída caem sempre no mesmo chat.

```ts
function normalizarTelefoneBR(num: string): string {
  const digits = num.replace(/\D/g, '');
  // 5562991672674 (13) já ok
  // 556291672674 (12) → adiciona 9 após DDD
  if (digits.length === 12 && digits.startsWith('55')) {
    return digits.slice(0, 4) + '9' + digits.slice(4);
  }
  return digits;
}
```

## Parte 2 — Mesclar as conversas duplicadas que já existem

Migração SQL única que percorre `whatsapp_mensagens` e atualiza todos os `telefone_remoto` de 12 dígitos (BR) para 13 dígitos. Com isso, todas as mensagens antigas do seu número (e de qualquer outro cliente afetado) vão se juntar numa só conversa no Inbox.

```sql
UPDATE whatsapp_mensagens
SET telefone_remoto = substring(telefone_remoto, 1, 4) || '9' || substring(telefone_remoto, 5)
WHERE length(regexp_replace(telefone_remoto, '\D', '', 'g')) = 12
  AND telefone_remoto LIKE '55%';
```

Faço o mesmo na tabela `chatbot_conversas` se ela tiver o mesmo padrão de chave por telefone.

# Resultado esperado

- O "oi" que você mandou agora vai aparecer junto com o resto do histórico.
- Toda nova mensagem entrando ou saindo cai no mesmo chat, independente do que a UAZAPI devolver.
- Sem mais conversas duplicadas com 12/13 dígitos.

# Sobre o impacto na Cloud

Mudança barata: 2 edge functions ajustadas + 1 UPDATE SQL. Sem novos crons, sem novas chamadas externas, sem consumo extra de IA.

# Arquivos afetados

- `supabase/functions/send-whatsapp/index.ts` — normalização ao salvar saída
- `supabase/functions/whatsapp-chatbot/index.ts` — normalização ao salvar entrada
- migração SQL — backfill das mensagens antigas

Aprove pra eu aplicar.