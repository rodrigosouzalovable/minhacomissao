

# Automação: Pós Atendimento → WhatsApp

## Contexto
O painel "Pós Atendimento" no CobMais exibe logs de chamadas com dados do cliente (nome, CPF, telefone). O objetivo é extrair esses dados automaticamente e enviar uma mensagem personalizada via WhatsApp.

## Abordagem

Criar um novo endpoint no `server.js` que:
1. Usa Playwright para ler o texto do painel "Pós Atendimento" (via `page.evaluate` extraindo o `textContent` do container)
2. Retorna o texto bruto para o frontend

Criar uma nova Edge Function `process-pos-atendimento` que:
1. Recebe o texto bruto do painel
2. Usa IA (Gemini Flash) para extrair estruturadamente: nome, telefone, CPF de cada cliente listado
3. Gera a mensagem personalizada com o primeiro nome do cliente
4. Chama a função `send-whatsapp` para enviar a mensagem

Na página `AutomacaoCobMais.tsx`:
1. Adicionar um botão/aba "Pós Atendimento" que aciona a automação
2. Permite configurar o template da mensagem (com variáveis como `{nome}`, `{telefone}`)
3. Exibe os clientes extraídos em uma lista antes do envio
4. Permite enviar individualmente ou em lote

## Arquitetura

```text
[CobMais Browser]
       │
  server.js (Playwright)
  POST /automacao/extrair-pos-atendimento
  → page.evaluate() extrai texto do painel
       │
  Edge Function: process-pos-atendimento
  → Gemini Flash parseia nome/telefone/CPF
  → Retorna lista estruturada
       │
  Frontend: lista clientes extraídos
  → Usuário confirma envio
       │
  Edge Function: send-whatsapp (já existente)
  → Envia mensagem via UAZAPI
```

## Detalhes Técnicos

### 1. Novo endpoint no `server.js`

```javascript
app.post('/automacao/extrair-pos-atendimento', async (req, res) => {
  const pg = await initBrowser();
  // Extrair texto do painel Pós Atendimento (iframe ou div no canto inferior direito)
  const texto = await pg.evaluate(() => {
    // Tentar múltiplos seletores do painel pós-atendimento
    const selectors = [
      '.pos-atendimento-content',
      '#pos-atendimento',
      '.discagem-log',
      // fallback: pegar todo texto visível do painel
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el.textContent;
    }
    return null;
  });
  res.json({ success: true, texto });
});
```

### 2. Nova Edge Function `process-pos-atendimento`

- Recebe o texto bruto
- Usa Gemini Flash via Lovable AI para extrair registros com regex + IA
- Retorna array de `{ nome, telefone, cpf }`

### 3. Frontend - Nova seção na página AutomacaoCobMais

- Botão "Capturar Pós Atendimento"
- Textarea editável com template de mensagem (padrão: "Olá {nome}, tudo bem?...")
- Tabela de clientes extraídos com checkbox para selecionar quais enviar
- Botão "Enviar WhatsApp" para disparar as mensagens

### Arquivos a criar/editar:
- `server.js` — novo endpoint `/automacao/extrair-pos-atendimento`
- `supabase/functions/process-pos-atendimento/index.ts` — nova Edge Function
- `src/pages/AutomacaoCobMais.tsx` — nova aba/seção no painel

