

# Adicionar suporte a teclas (F5, Enter, etc.) e salvar instruções do usuário como conhecimento

## Problema
O robô atualmente só suporta 6 ações: `click`, `fill`, `scroll`, `wait`, `navigate`, `select`. Não consegue pressionar teclas como F5 (atualizar página), Enter, Escape, Tab, etc. Além disso, quando o usuário ensina algo no chat, essa informação não é salva como conhecimento.

## Solução

### 1. Adicionar ação `keypress` em toda a cadeia

| Arquivo | Mudança |
|---|---|
| `server.js` | Adicionar case `keypress` no switch de ações do agente — usar `page.keyboard.press(value)` do Playwright |
| `supabase/functions/analyze-cobmais-screen/index.ts` | Adicionar `keypress` ao enum de ações e descrição do parâmetro `value` |
| `supabase/functions/chat-cobmais-knowledge/index.ts` | Atualizar system prompt com exemplos de teclas (F5, Enter, Escape, Tab) |

**server.js** — novo case no switch (linha ~997):
```javascript
case 'keypress': {
  await pg.keyboard.press(aiAction.value || 'F5');
  await delay(2000);
  break;
}
```

**analyze-cobmais-screen** — enum atualizado:
```
enum: ['click', 'fill', 'scroll', 'wait', 'navigate', 'select', 'keypress', 'done', 'error']
```
E na descrição do `value`: adicionar `"ou tecla (action=keypress: F5, Enter, Escape, Tab)"`

**chat-cobmais-knowledge** — adicionar no prompt regra 13:
```
"atualize a página clicando F5", "pressione Enter", "pressione Escape para fechar o modal"
```

### 2. Salvar instruções do usuário como conhecimento

Quando a IA executa uma ação com sucesso baseada em instrução do usuário, salvar automaticamente na tabela `cobmais_conhecimento` para que o robô aprenda.

| Arquivo | Mudança |
|---|---|
| `supabase/functions/chat-cobmais-knowledge/index.ts` | Após disparar automação, salvar o objetivo como conhecimento na tabela usando `adminClient` |

Inserir na `cobmais_conhecimento` com:
- `nome_fluxo`: "chat_aprendido"  
- `acao`: extraída do objetivo (navigate, keypress, click, fill)
- `descricao_tela`: o objetivo completo do usuário
- `sessao_id`: null (aprendido via chat)

