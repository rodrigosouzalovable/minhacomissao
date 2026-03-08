

# Corrigir mensagem de notificação ao admin

## Problema
A mensagem está com os números trocados. Atualmente mostra:
- "enviada pelo número **556281036664**" (que é o cliente)
- "para o número **desconhecido**" (que deveria ser a instância)

O correto é:
- "enviada pelo número **62991672674**" (número da instância/remetente)
- "para o número **556281036664**" (cliente)

Além disso, o `telefoneInstancia` está caindo em `'desconhecido'` porque os campos do payload UAZAPI (`phone`, `instance.wuid`, `wuid`) não estão presentes.

## Mudanças em `supabase/functions/whatsapp-chatbot/index.ts`

### 1. Corrigir a ordem na mensagem (linha 128)
Trocar para: `"enviada pelo número ${telefoneInstancia} para o número ${telefoneCliente}"` — instância primeiro, cliente depois.

### 2. Melhorar extração do telefone da instância (linha 558)
Adicionar mais campos possíveis do payload UAZAPI e também tentar extrair da `server_url` ou do registro da instância no banco (`user_whatsapp_instances`). Se o token da instância estiver disponível, buscar o número associado na tabela `user_whatsapp_instances` como fallback.

### Arquivo alterado
- `supabase/functions/whatsapp-chatbot/index.ts`

