

## Problema
Mensagens enviadas pelo Acionamento (e outras páginas como Retornos, AcordoDetalhe) não aparecem no Inbox porque o `instancia_id` não é enviado para a Edge Function `send-whatsapp`. Sem esse ID, a função não consegue salvar a mensagem na tabela `whatsapp_mensagens`.

### Páginas afetadas
- **Acionamento** — passa `server_url` e `instance_token` mas **não** passa `instancia_id`
- **Retornos** — não passa nenhuma credencial nem `instancia_id`
- **AcordoDetalhe** — não passa credenciais nem `instancia_id`
- **Acordos** — passa credenciais mas **não** `instancia_id`
- **useAutoSend** — passa credenciais mas **não** `instancia_id`
- **PaymentReminders** — precisa verificar

### Correção

1. **Acionamento (`src/pages/Acionamento.tsx`)**:
   - Alterar `getFirstActiveConfig` para incluir o `id` da instância
   - Passar `instancia_id` no body de todas as chamadas `send-whatsapp`

2. **Acordos (`src/pages/Acordos.tsx`)**:
   - Incluir `instancia_id` na chamada (já tem a instância com `id` disponível)

3. **Retornos (`src/pages/Retornos.tsx`)**:
   - Buscar a instância ativa do usuário e passar `instancia_id` + credenciais

4. **AcordoDetalhe (`src/pages/AcordoDetalhe.tsx`)**:
   - Buscar a instância ativa do usuário e passar `instancia_id` + credenciais

5. **useAutoSend (`src/hooks/useAutoSend.tsx`)**:
   - Incluir `instancia_id` na chamada (já tem referência à instância)

6. **PaymentReminders** — verificar e corrigir se necessário

### Resultado
Toda mensagem enviada por qualquer parte do sistema será salva no inbox e aparecerá na conversa, mesmo que o cliente não responda.

