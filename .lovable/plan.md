

# Corrigir IA do Chat CobMais: Comandos Não Executam Corretamente

## Problema Raiz

Analisei os logs detalhadamente. O que acontece:

1. Voce diz "clique em Cobrança" no chat
2. A IA decide usar `executar_acao_direta` com `selector: "Cobrança"` ou `selector: "span:has-text('Cobrança')"`
3. O server.js tenta `pg.$("Cobrança")` — **falha** (não é seletor CSS válido)
4. Tenta fallback `pg.click("text=Cobrança")` — clica em **elemento errado ou nada**
5. Server retorna `success: true` mesmo sem verificar se funcionou
6. A IA diz "✅ Feito!" **sem confirmar que realmente aconteceu**

O problema é que a IA **adivinha** o seletor pelo texto, mas o CobMais usa HTML complexo (iframes, JS events, menus customizados) onde seletores genéricos não funcionam.

## Solução: "Smart Click" com Visão

Antes de executar qualquer ação direta, a IA vai **olhar a tela primeiro** (capturar screenshot do server), usar a visão computacional para identificar o **seletor correto**, executar, e depois **verificar o resultado** com outra screenshot.

## Mudanças Técnicas

### 1. `chat-cobmais-knowledge` — Novo fluxo para `executar_acao_direta`

Quando a IA decide usar ação direta (click, fill, etc.):

```text
ANTES: IA adivinha selector → executa → diz "Feito!" cegamente
DEPOIS: captura screenshot → analyze-cobmais-screen identifica selector → executa → captura screenshot de verificação → responde com honestidade
```

- Chamar `server/screenshot` para obter a tela atual
- Enviar screenshot + instrução para `analyze-cobmais-screen` (que usa Gemini Pro Vision)
- Usar o seletor retornado pela visão em vez do seletor adivinhado
- Após execução, capturar nova screenshot para confirmar mudança
- Se não mudou nada, retornar erro honesto ao invés de "Feito!"

### 2. `server.js` — Adicionar ação `click_at_position`

Novo action para o endpoint `/automacao/acao-direta`:
- Recebe `x` e `y` como coordenadas de pixel
- Executa `pg.mouse.click(x, y)`
- Fallback quando seletores CSS falham

### 3. `chat-cobmais-knowledge` — Atualizar system prompt

Conforme as preferências do usuario:
- **Hibrido inteligente**: ação direta com visão para comandos simples, agente multi-passo para fluxos longos
- **Falhar e pedir ajuste**: nunca dizer "Feito!" sem verificar; se falhou, mostrar print da tela e pedir orientação
- **Uma etapa por vez**: executar apenas o que foi pedido, parar e aguardar próximo comando

### 4. `analyze-cobmais-screen` — Aceitar modo "single action"

Adicionar suporte para receber uma instrução simples (ex: "clique no botão Cobrança") e retornar o seletor/coordenadas corretos sem loop de agente.

## Arquivos a Editar

- `supabase/functions/chat-cobmais-knowledge/index.ts` — lógica de visão antes de ação direta + prompt atualizado
- `server.js` — novo action `click_at_position` + timeouts adequados
- `supabase/functions/analyze-cobmais-screen/index.ts` — aceitar modo single-action

