

## Diagnóstico: Por que a mensagem não apareceu no Inbox

### O que aconteceu

Investiguei o banco de dados e os logs da função webhook. Encontrei dois problemas:

**Problema 1 - Mensagens enviadas manualmente pelo WhatsApp são ignoradas:**
Quando você envia uma mensagem diretamente pelo aplicativo WhatsApp (não pelo sistema), o webhook UAZAPI dispara com `fromMe=true`. Atualmente, o código do webhook ignora todas as mensagens `fromMe` (para evitar duplicação com as mensagens enviadas pelo próprio sistema). Isso significa que mensagens enviadas manualmente nunca aparecem no Inbox.

**Problema 2 - Webhook do número 62991672674 possivelmente não configurado:**
A instância `62991672674` tem zero mensagens e zero contatos no banco. Nenhum log do webhook foi encontrado para essa instância. Isso indica que o webhook da UAZAPI para esse número pode não estar apontando para a URL da função `whatsapp-chatbot`.

### Solução proposta

**`supabase/functions/whatsapp-chatbot/index.ts`:**
- Em vez de ignorar completamente mensagens `fromMe`, salvar no inbox verificando antes se já existe uma mensagem similar recente (últimos 30 segundos, mesmo instancia_id + telefone_remoto + conteúdo). Isso evita duplicação com mensagens do `send-whatsapp` mas captura mensagens enviadas manualmente pelo app
- Também atualizar o contato (upsert) para mensagens `fromMe`

### Sobre o webhook do 62991672674
Isso precisa ser verificado no painel da UAZAPI: o webhook desse número deve apontar para a URL da função `whatsapp-chatbot`. Sem isso, mensagens recebidas nesse número nunca chegarão ao sistema. Posso verificar a configuração via API se necessário.

### Detalhes técnicos

No trecho que atualmente faz (linhas ~642-644):
```text
if (isFromMe) {
  console.log('[INBOX] Ignorando fromMe...');
} else { ... salva mensagem ... }
```

Mudar para: verificar se já existe mensagem recente com mesmo `instancia_id`, `telefone_remoto`, `conteudo` nos últimos 30s. Se não existir, salvar como `direcao: 'saida'`. Se já existir, pular (evita duplicação).

