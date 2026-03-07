

# Agente Inteligente: Gemini Vision + Playwright

## Conceito

Substituir o fluxo hardcoded de 12 passos por um **loop autônomo**: o robô captura screenshot → envia para Gemini Vision → recebe a próxima ação → executa via Playwright → repete até concluir.

```text
┌─────────────┐     ┌──────────────────┐     ┌────────────┐
│  Playwright  │────▶│  Edge Function   │────▶│  Gemini    │
│  Screenshot  │     │  (analyze-screen)│     │  Vision    │
│  + DOM info  │◀────│  Retorna ação    │◀────│  2.5 Pro   │
└─────────────┘     └──────────────────┘     └────────────┘
       │                                            │
       ▼                                            │
  Executa ação                              Analisa imagem
  (click, fill,                             + contexto e
   scroll, wait)                            retorna JSON
       │                                    com próxima ação
       └────────────── LOOP ────────────────┘
```

## Arquitetura

### 1. Nova Edge Function: `analyze-cobmais-screen`

Recebe:
- Screenshot base64 da tela atual
- Objetivo da tarefa (ex: "gerar boleto para CPF X com valor Y")
- Histórico de ações já executadas

Envia para **Gemini 2.5 Pro** (modelo vision) via Lovable AI Gateway com tool calling para retornar ação estruturada:

```json
{
  "action": "click",
  "selector": "#btnCalcular",
  "description": "Clicar no botão Cálculo",
  "confidence": 0.95,
  "done": false
}
```

Tipos de ação suportados: `click`, `fill`, `scroll`, `wait`, `navigate`, `done`, `error`

### 2. Novo endpoint no `server.js`: `/automacao/agent`

Loop autônomo:
1. Captura screenshot + URL atual
2. Chama edge function `analyze-cobmais-screen` com imagem + objetivo + histórico
3. Recebe ação estruturada
4. Executa via Playwright (click, fill, scroll, etc.)
5. Aguarda resultado (navegação, modal, etc.)
6. Volta ao passo 1
7. Para quando IA retorna `"done": true` ou após N iterações (safety limit)

### 3. System Prompt do Agente

Prompt detalhado ensinando ao Gemini:
- A estrutura do CobMais (menus, abas, modais)
- Fluxos conhecidos (gerar boleto, cadastrar email, pesquisar CPF)
- Seletores conhecidos como "dicas" (não obrigatórios)
- Regras de segurança (nunca deletar dados, nunca alterar senhas)
- Como identificar erros (toasts amarelos/vermelhos)
- Como se recuperar de erros

### 4. Atualização da Edge Function `automacao-cobmais`

Nova action `agent_execute` que:
- Recebe objetivo + parâmetros
- Inicia o loop no server.js via `/automacao/agent`
- Retorna resultado final + log de todas as ações

### 5. UI: Modo Agente na página de Automação

- Toggle "Modo Agente" vs "Modo Script" 
- Campo de texto livre: "O que você quer que o robô faça?"
- Visualização em tempo real das decisões da IA
- Log de cada iteração: screenshot → decisão → resultado

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/analyze-cobmais-screen/index.ts` | **Criar** - Edge function com Gemini Vision |
| `server.js` | **Modificar** - Adicionar endpoint `/automacao/agent` com loop autônomo |
| `src/pages/AutomacaoCobMais.tsx` | **Modificar** - Adicionar modo agente na UI |
| `src/components/RoboStreamViewer.tsx` | **Modificar** - Exibir log de decisões da IA |

## Limitações e Segurança

- **Safety limit**: Máximo 30 iterações por tarefa
- **Timeout**: 5 minutos total por execução
- **Fallback**: Se confiança < 0.7, para e pede confirmação humana
- **Custo**: Cada iteração envia ~200KB de imagem ao Gemini (usar JPEG quality 40)
- **Modelo**: Gemini 2.5 Pro (único com vision forte o suficiente para DOM analysis)

