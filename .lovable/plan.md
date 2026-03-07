

# Sistema de Aprendizado: IA observa você usando o CobMais

## Ideia

Criar um **modo gravação** onde o robô Playwright captura screenshots + suas ações enquanto você navega no CobMais. Essas "lições" são salvas no banco de dados e automaticamente injetadas no prompt da IA, fazendo ela aprender permanentemente como o sistema funciona.

## Como funciona

1. **Modo Gravação**: Você clica "Gravar Sessão" na página de automação. O robô começa a capturar screenshots a cada ação que você faz (cliques, preenchimentos) no navegador Playwright.

2. **Armazenamento**: Cada passo é salvo numa tabela `cobmais_conhecimento` com:
   - Descrição da tela (gerada pela IA ao ver o screenshot)
   - Ação executada (clique, preenchimento, navegação)
   - Seletor CSS usado
   - URL da página
   - Ordem do passo dentro do fluxo

3. **Uso pelo Agente**: Quando o agente IA executa, o sistema busca lições relevantes da tabela e injeta no prompt, tipo: "Quando estiver na tela X, o passo correto é clicar em Y".

## Alterações

| Componente | O que muda |
|---|---|
| **Nova tabela `cobmais_conhecimento`** | Armazena fluxos aprendidos: nome do fluxo, passos com descrição, seletor, URL, screenshot_description |
| **Nova tabela `cobmais_sessoes_gravadas`** | Metadados das sessões gravadas (nome, data, número de passos) |
| **Edge Function `analyze-cobmais-screen`** | Busca conhecimento relevante do banco e injeta no SYSTEM_PROMPT antes de chamar a IA |
| **`server.js`** | Novo endpoint `/automacao/gravar` que ativa modo gravação: intercepta eventos do Playwright (clicks, inputs) e envia para o backend |
| **`server.js`** | Novo endpoint `/automacao/parar-gravacao` para finalizar sessão |
| **`AutomacaoCobMais.tsx`** | Novo botão "Gravar Sessão" + "Parar Gravação" na interface, e aba para ver/gerenciar lições aprendidas |

## Fluxo do Usuário

1. Abre a página de Automação CobMais
2. Clica "🎓 Gravar Sessão" e dá um nome (ex: "Como gerar boleto")
3. Navega normalmente no CobMais pelo navegador Playwright (visível no stream)
4. O sistema captura cada clique/input + screenshot + URL
5. Ao terminar, clica "Parar Gravação"
6. A IA analisa os screenshots e gera descrições de cada passo
7. Próxima vez que o agente rodar, ele já terá esse conhecimento

## Estrutura da tabela

```text
cobmais_conhecimento
├── id (uuid)
├── sessao_id (uuid, FK → cobmais_sessoes_gravadas)
├── nome_fluxo (text) — ex: "gerar_boleto"
├── passo_numero (int)
├── descricao_tela (text) — gerada pela IA
├── acao (text) — click, fill, navigate
├── seletor (text) — CSS selector
├── valor (text) — valor preenchido, se aplicável
├── url_pagina (text)
├── criado_em (timestamptz)
```

