

# Persistência por Usuário e Controle de Envio Automático no Acionamento

## Problemas Identificados

### 1. Dados compartilhados entre todos os logins (CRÍTICO)
Todas as chaves do localStorage são globais (ex: `acionamento_historico`, `acionamento_ativo`). Isso significa que se o funcionário A importa uma planilha e o funcionário B faz login no mesmo navegador, B verá os dados de A. Mesmo em navegadores diferentes, se dois funcionários acessarem o mesmo dispositivo, os dados se misturam.

### 2. Envio automático retoma sem consentimento
Ao recarregar a página ou navegar de volta, o sistema automaticamente retoma o envio se havia um estado salvo em `AUTO_SENDING_KEY`. Isso pode causar envios indesejados.

### 3. Botão "Parar" funciona corretamente
O mecanismo de parada (`autoSendingRef.current = false`) está correto. O loop verifica essa flag antes de cada envio e para após o envio em andamento concluir. Não há problema aqui.

## Solução

### Alteração em `src/pages/Acionamento.tsx`

**Tornar todas as chaves do localStorage específicas por usuário**, incluindo o `user.id` em cada chave:

```text
Antes:  'acionamento_historico'
Depois: 'acionamento_historico_<user.id>'
```

Chaves afetadas (7 no total):
- `MENSAGENS_KEY` → mensagens salvas
- `HISTORICO_KEY` → histórico de importações
- `ACTIVE_KEY` → planilha ativa
- `SEND_STATUS_KEY` → status de envio por cliente
- `MANUAL_CHECKED_KEY` → marcações manuais
- `SEND_TIMESTAMPS_KEY` → timestamps de envio
- `AUTO_SENDING_KEY` → estado do envio automático

**Implementação**: As constantes deixarão de ser fixas e passarão a ser derivadas do `user.id` via uma função helper. O `useEffect` de carregamento será condicionado ao `user` estar disponível.

**Envio automático**: O auto-resume só será executado se a chave correspondente ao usuário logado tiver estado `active: true`. Ao trocar de usuário, o novo login não verá nem retomará envios de outro usuário.

### Resumo de alterações
- **1 arquivo**: `src/pages/Acionamento.tsx` — prefixar todas as chaves localStorage com `user.id`

