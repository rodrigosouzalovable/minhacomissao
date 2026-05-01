## Problema

Ao clicar em "Verificar WhatsApp" com 50 números, o sistema mostrou "Todos os números possuem WhatsApp" mesmo havendo telefones inválidos.

## Causa raiz (confirmada nos logs)

Os logs da edge function `check-whatsapp-numbers` mostram:

```
INFO  Verificando lote 1: 50 números
ERROR Erro no lote 1: The signal has been aborted
```

A UAZAPI estourou o timeout de 25s ao validar 50 números de uma vez. Quando isso acontece:

1. A edge function joga os 50 números no array `errors` (não `invalid`).
2. O frontend (`handleVerificarWhatsApp` em `src/pages/Acionamento.tsx`) **só olha para `data.invalid`** e ignora completamente `data.errors`.
3. Como `invalid` veio vazio, a UI assume sucesso total e mostra "Todos os números possuem WhatsApp ✓" — falso positivo.

## Correções

### 1. Edge function `supabase/functions/check-whatsapp-numbers/index.ts`

- Reduzir `BATCH_SIZE` de 50 → **15** (UAZAPI responde rápido com lotes menores).
- Aumentar `REQUEST_TIMEOUT_MS` de 25s → **45s** por lote.
- Adicionar **1 retry automático** quando o lote dá timeout/abort, antes de marcar como erro.
- Reduzir `CONCURRENCY` de 5 → **3** para não sobrecarregar a instância.
- Logar contagem final (`valid/invalid/errors`) para diagnóstico.

### 2. Frontend `src/pages/Acionamento.tsx` (`handleVerificarWhatsApp`)

- Tratar `data.errors` como **caso de falha visível**, não como sucesso silencioso.
- Se `errors.length > 0`:
  - Mostrar toast de aviso: "X números não puderam ser verificados (timeout). Tente novamente."
  - **Não** marcar `verificacaoConcluida = true` se TODOS caíram em erro (evita o falso "Todos possuem WhatsApp").
  - Se parte foi verificada e parte falhou, manter os válidos/inválidos processados e avisar sobre os pendentes.
- Adicionar os números em erro a uma nova lista `numerosNaoVerificados` exibida em um Alert amarelo, com botão "Tentar novamente" que reenvia só esses números.

### 3. Validação visual

Após a correção, o usuário deve:
- Ver os 2 números sem WhatsApp removidos corretamente, OU
- Ver um aviso claro caso a UAZAPI continue lenta, em vez do falso "todos válidos".

## Arquivos alterados

- `supabase/functions/check-whatsapp-numbers/index.ts`
- `src/pages/Acionamento.tsx`