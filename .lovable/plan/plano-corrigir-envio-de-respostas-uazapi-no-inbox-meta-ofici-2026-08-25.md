# Plano: corrigir envio de respostas UAZAPI no Inbox Meta Oficial

## Problema confirmado
Do I know what the issue is? Sim.

A conversa da imagem está em uma instância espelhada da UAZAPI:

- Instância no Inbox: `THIAGO 3 N3`
- Provedor: `uazapi`
- Instância UAZAPI vinculada: ativa/conectada
- Telefone da conversa salvo no Inbox: `5515553487840`
- Última mensagem recebida: a propaganda “Olá, aqui é a Lisboa e Lima Comercio...”
- Ao responder manualmente, a função `send-whatsapp-meta-text` envia para a UAZAPI usando apenas esse telefone salvo no Inbox.
- A UAZAPI respondeu que o destino `5515553487840@s.whatsapp.net` “is not on WhatsApp”.

Isso não significa que a instância THIAGO 3 N3 está desconectada. Significa que o destino da conversa foi recusado pela UAZAPI no envio, mesmo tendo chegado uma mensagem desse identificador. Isso pode ocorrer com números/IDs não respondíveis, números comerciais/robôs, remetentes temporários/spam ou divergência entre o JID real recebido no webhook e o telefone normalizado salvo no Inbox.

## Arquivos envolvidos

- `supabase/functions/send-whatsapp-meta-text/index.ts`
  - Rota que o Inbox usa para responder mensagens.
  - Hoje, para `provider = 'uazapi'`, tenta apenas `/send/text` e envia `number: telefone`.

- `supabase/functions/_shared/espelho-inbox-meta.ts`
  - Salva mensagens UAZAPI dentro do Inbox Meta Oficial.
  - Hoje preserva o telefone normalizado, mas não garante um destino alternativo de envio quando a UAZAPI recusa o telefone.

- `supabase/functions/whatsapp-chatbot/index.ts`
  - Recebe webhooks UAZAPI e chama o espelhamento para o Inbox.
  - É onde podemos preservar mais dados úteis do remetente original se necessário.

- `src/pages/InboxMeta.tsx`
  - Mostra o erro ao atendente.
  - Já chama `send-whatsapp-meta-text`, mas precisa exibir erro mais claro e não deixar uma mensagem temporária confusa.

## Correção proposta

1. **Tornar o envio UAZAPI mais resiliente**
   - Na função `send-whatsapp-meta-text`, quando a instância for UAZAPI, tentar os endpoints já usados em outros fluxos do sistema:
     - `/send/text`
     - `/message/sendText`
     - `/sendText`
   - Enviar com variações seguras do destinatário:
     - telefone numérico salvo no Inbox;
     - JID `telefone@s.whatsapp.net`;
     - telefone sem o 9º dígito quando for um número brasileiro com DDD e 9 dígitos locais;
     - JID da variação sem o 9º dígito.
   - Parar assim que uma tentativa for aceita.

2. **Não confundir instância conectada com destinatário inválido**
   - Se todas as tentativas forem recusadas por “not on WhatsApp”, retornar uma mensagem clara:
     - a instância está conectada;
     - o destinatário/remetente foi recusado pela UAZAPI;
     - esse contato não deve travar o IAGO nem o atendimento.

3. **Persistir o erro corretamente no histórico**
   - Registrar a tentativa como mensagem de saída com `status_envio = erro` e o motivo legível.
   - Atualizar o preview da conversa sem arquivar/sumir a conversa.

4. **Proteger o IAGO**
   - Manter o IAGO sem loop quando a UAZAPI recusar o destinatário.
   - Para mensagens de spam/divulgação como “Lisboa e Lima Comercio”, manter escalonamento humano ou silêncio automático, sem travar novas conversas legítimas da caixa Aquecimento.

5. **Validar depois da alteração**
   - Fazer deploy das funções afetadas.
   - Testar a função de envio com a instância THIAGO 3 N3 e o contato da imagem.
   - Conferir se o retorno diferencia:
     - sucesso em alguma variação de destino; ou
     - recusa real do destinatário, com erro legível no Inbox.

## Resultado esperado

- Se o problema for apenas formato de destino, a resposta manual voltará a sair normalmente pela THIAGO 3 N3.
- Se a UAZAPI realmente recusar esse remetente específico, o sistema mostrará que a instância está conectada e que o problema é o destinatário, sem marcar a instância como erro e sem deixar o IAGO travado.
