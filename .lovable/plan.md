

# Resposta do Admin via WhatsApp para Retomar Atendimento

## Problema
Quando a IA não sabe responder, ela notifica o admin (62991672674) com detalhes do cliente. Mas o admin não pode responder pelo WhatsApp para instruir a IA — ele precisa acessar o sistema manualmente.

## Solução
Interceptar mensagens recebidas do número do admin (ADMIN_NUMERO) no webhook e tratá-las como instruções para responder ao cliente que está em `aguardando_humano`.

## Fluxo
1. Mensagem chega no webhook e `telefone === ADMIN_NUMERO` (não é `isFromMe`)
2. Buscar no banco qual cliente está em `aguardando_humano` para aquela instância (usando `server_url`/`instance_token` do payload)
3. Se texto entre aspas (`"..."`) → enviar exatamente o conteúdo entre aspas ao cliente
4. Se texto livre → usar IA para formular resposta baseada na instrução do admin + contexto da conversa, e enviar ao cliente
5. Desbloquear conversa do cliente (voltar à etapa anterior) e dar sequência no fluxo

## Alterações em `supabase/functions/whatsapp-chatbot/index.ts`

### 1. Salvar referência do cliente na notificação
Quando `salvarSilenciosoENotificar` é chamado, também salvar um registro especial `chatbot_conversas` com telefone = `admin_pending_{instanceToken}` contendo o telefone do cliente e a instância. Isso permite saber para qual cliente o admin está respondendo.

### 2. Novo bloco de interceptação (após filtros básicos, antes do debounce)
```
if (telefone === ADMIN_NUMERO && !isFromMe) {
  // Admin está respondendo instrução
  // 1. Buscar registro admin_pending_{instanceToken}
  // 2. Extrair telefone do cliente pendente
  // 3. Parsear instrução:
  //    - Se entre aspas: mensagem literal
  //    - Se livre: usar IA para formular resposta com contexto
  // 4. Enviar resposta ao cliente (com typing delay)
  // 5. Desbloquear conversa do cliente
  // 6. Remover registro admin_pending
  return Response(...)
}
```

### 3. Se houver múltiplos clientes pendentes
Priorizar o mais recente (último `atualizado_em`). Se o admin precisar especificar, pode incluir o número no texto.

### 4. Lógica de parsing da instrução
```typescript
function parseAdminInstruction(texto: string): { literal: boolean; conteudo: string } {
  const match = texto.match(/^"(.+)"$/s) || texto.match(/^"(.+)"$/s);
  if (match) return { literal: true, conteudo: match[1] };
  return { literal: false, conteudo: texto };
}
```

Para instruções não-literais (ex: "passei a proposta para o cliente"), a IA gerará uma resposta usando o contexto da conversa + instrução do admin.

## Arquivo alterado
- `supabase/functions/whatsapp-chatbot/index.ts`

