

# Injetar data atual no sistema de ensino e no chatbot

## Problema
A IA de ensino (teach-chatbot) e o chatbot de negociação não sabem qual é a data atual. Quando o admin ensina regras com `[DATA_LIMITE_7_DIAS]`, a IA não consegue calcular dinamicamente.

## Solução

### 1. `supabase/functions/teach-chatbot/index.ts`
Adicionar a data atual no `SYSTEM_PROMPT` dinamicamente:

```
CONTEXTO TEMPORAL:
- A data de hoje é: ${new Date().toLocaleDateString('pt-BR')} (${new Date().toISOString().slice(0,10)})
- Quando o admin mencionar "[DATA_LIMITE_7_DIAS]", isso significa a data de hoje + 7 dias corridos.
- Você pode calcular datas dinamicamente com base na data atual.
```

Mudar o `SYSTEM_PROMPT` de `const` estática para uma função que gera o prompt com a data atual a cada request.

### 2. `supabase/functions/whatsapp-chatbot/index.ts`
Na função `classificarIntencao` e nos prompts de sistema do chatbot, injetar a data atual para que a IA consiga interpretar referências temporais do cliente (ex: "semana que vem", "sexta-feira").

Já existe lógica de cálculo de data limite no código (linha ~822), mas o prompt de classificação de intenção (linha ~89) não tem contexto de data. Adicionar:

```
Hoje é ${new Date().toLocaleDateString('pt-BR')}.
```

## Arquivos alterados
- `supabase/functions/teach-chatbot/index.ts` — prompt dinâmico com data atual
- `supabase/functions/whatsapp-chatbot/index.ts` — injetar data no prompt de classificação

