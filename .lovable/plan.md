

## Plano: Automação completa CobMais — Fluxo de emissão de boleto

### Contexto

O usuário quer que, quando um cliente aceitar uma negociação via WhatsApp, o sistema automaticamente:
1. Entre no CobMais via robô Playwright
2. Busque o cliente por CPF
3. Abra a ficha, crie o acordo com os valores negociados
4. Emita o boleto
5. Envie o link do boleto de volta pelo WhatsApp

O passo a passo detalhado do CobMais foi fornecido pelo usuário com screenshots.

### Limitação importante

O Playwright roda no servidor local do usuário. O que posso fazer aqui é:

1. **Definir o protocolo de comunicação** — adicionar a ação `gerar_boleto_cobmais` no edge function e frontend
2. **Integrar o chatbot WhatsApp** com a automação — quando o cliente aceitar, disparar o comando ao robô
3. **Fornecer o código do servidor Playwright** que o usuário precisa rodar localmente

### Mudanças

#### 1. Edge Function `automacao-cobmais` — nova ação `gerar_boleto`
- Aceitar ação `gerar_boleto` com parâmetros: `cpf`, `valor_final`, `tipo_pagamento` (avista/parcelado), `parcelas`
- Enviar ao servidor Playwright via POST com timeout de 180s (processo leva mais tempo)
- Registrar comando e logs normalmente

#### 2. Frontend `AutomacaoCobMais.tsx`
- Adicionar ação `gerar_boleto` na lista `ACOES_DISPONIVEIS` com params `['cpf', 'valor_final', 'tipo_pagamento']`
- Permitir teste manual do fluxo pelo console

#### 3. Chatbot WhatsApp — novo fluxo de aceitação
- Após enviar a proposta (`proposta_enviada`), aceitar respostas como "1" (à vista) ou "2" (parcelado)
- Nova etapa `aguardando_parcelas` se parcelado (cliente informa qtd parcelas)
- Nova etapa `acordo_aceito` — dispara comando `gerar_boleto` para o robô via edge function
- Quando robô retornar o link do boleto, enviar mensagem ao cliente com o link

#### 4. Código do servidor Playwright (referência para o usuário)
- Fornecer o script Node.js completo com o fluxo exato descrito pelo usuário:
  - Login → Menu → Cobrança → Pesquisa CPF → Abrir ficha → Cálculo → Selecionar parcelas → Definir valor → Atualizar → Salvar Acordo → Emitir Boleto → Capturar link

### Arquivos a modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/automacao-cobmais/index.ts` | Adicionar ação `gerar_boleto` com timeout 180s |
| `supabase/functions/whatsapp-chatbot/index.ts` | Adicionar fluxo de aceitação de acordo + disparo da automação |
| `src/pages/AutomacaoCobMais.tsx` | Adicionar `gerar_boleto` nas ações disponíveis do console |

### Fluxo completo

```text
Cliente WhatsApp: "1" (à vista)
        ↓
Chatbot: registra acordo aceito
        ↓
Edge Function: POST automacao-cobmais { acao: "gerar_boleto", cpf, valor, tipo }
        ↓
Servidor Playwright local:
  1. Login CobMais
  2. Menu → Cobrança → Pesquisa CPF
  3. Abrir ficha cliente
  4. Cálculo → Selecionar todas parcelas
  5. Tipo pagamento (à vista/parcelado)
  6. Valor final mínimo
  7. Atualizar → Salvar Acordo
  8. Emitir Boleto → Capturar link
        ↓
Retorna { boleto_url: "https://..." }
        ↓
Chatbot envia no WhatsApp:
  "Seu boleto foi gerado! Segue o link: ..."
```

### Observações
- O servidor Playwright precisa expor endpoint `POST /automacao/cobmais` com ação `gerar_boleto`
- O chatbot chamará a edge function internamente (server-side) sem necessidade de auth do cliente
- Timeout de 180s para dar tempo ao Playwright completar o fluxo no CobMais

