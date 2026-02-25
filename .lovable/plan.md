

# Envio Automático Persistente Entre Abas

## Problema

O envio automático vive dentro do componente `Acionamento.tsx`. Quando o usuário navega para outra página (ex: Dashboard, Acordos), o componente é desmontado pelo React Router e o loop de envio para imediatamente. O estado se perde.

## Solução

Criar um **Context Provider global** (`AutoSendProvider`) que vive no nível do `App.tsx`, acima de todas as rotas. Isso garante que o loop de envio automático continue rodando independentemente da página em que o usuário esteja.

### Arquitetura

```text
App.tsx
  └── AuthProvider
        └── AutoSendProvider  ← NOVO (persiste entre rotas)
              └── Routes
                    ├── /dashboard
                    ├── /acordos
                    ├── /admin/acionamento  ← usa useAutoSend() para controlar
                    └── ...
```

### Alterações

**1. Novo arquivo: `src/hooks/useAutoSend.tsx`**
- Context Provider com toda a lógica do loop de envio automático
- Expõe: `startAutoSend()`, `stopAutoSend()`, `autoSending`, `autoProgress`
- Mantém refs internas para `clientes`, `mensagensSalvas`, config UAZAPI, etc.
- O loop usa `useRef` para evitar stale closures
- Atualiza `sendStatus` e `sendTimestamps` no localStorage em tempo real
- Limpa estado ao completar ou ao chamar `stopAutoSend()`

**2. Alterar: `src/App.tsx`**
- Envolver as rotas com `<AutoSendProvider>`

**3. Alterar: `src/pages/Acionamento.tsx`**
- Remover a lógica interna de `runAutoSendLoop`, `handleAutoSend`, `handleStopAutoSend`
- Importar `useAutoSend()` do novo hook
- Ao clicar "Iniciar": chamar `startAutoSend(clientes, mensagensSalvas, config, min, max, historicoId)`
- Ao clicar "Parar": chamar `stopAutoSend()`
- Sincronizar `sendStatus` e `sendTimestamps` do contexto com o estado local do componente (via callback ou subscription)
- O componente continua responsável pela UI, importação de planilhas e gerenciamento de mensagens

### Comportamento esperado
- Usuário clica "Iniciar" → envio começa
- Usuário muda de aba (Dashboard, Acordos, etc.) → envio continua
- Usuário volta ao Acionamento → vê o progresso atualizado
- Usuário clica "Parar" → envio para imediatamente
- Usuário fecha/recarrega a página → envio para (não retoma automaticamente)

### Resumo de arquivos
- **1 novo**: `src/hooks/useAutoSend.tsx`
- **2 alterados**: `src/App.tsx`, `src/pages/Acionamento.tsx`

