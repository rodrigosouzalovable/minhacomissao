# Corrigir erro de envio (#100) e liberar respostas na janela de 24h

## O que os dados mostram

O erro do print veio do número **SOUZA 62 8268-4387** (é o mesmo número que atende a conversa da segunda imagem). O ID `1351533164699701` que a Meta diz "não existir" é exatamente o `phone_number_id` cadastrado nessa instância no sistema.

- Essa instância enviou normalmente até **19/08 às 20:16 (BRT)**; depois disso todo envio passou a falhar.
- O último recebimento do cliente foi **19/08 20:58 (BRT)** — ou seja, às 09:14 de hoje a janela de 24h ainda estava aberta e o texto livre era permitido. **A falha não foi por qualidade nem por janela.**
- A instância está com qualidade **RED**, mas com "qualidade liberada manual" ligada e estado do pool "ativo" — nada nosso bloqueou o envio.

Conclusão: não é erro de código nosso. O erro `#100 – Object with ID ... does not exist, cannot be loaded due to missing permissions` é da Meta e significa que aquele número/telefone deixou de estar acessível pelo token atual — normalmente porque o número foi removido/desabilitado do WABA, migrou de Business Manager, ou o token do app perdeu permissão sobre ele. Precisa ser reconectado do lado da Meta. O que falta no sistema é: (1) explicar isso em português quando acontecer, e (2) parar de insistir nesse número automaticamente.

## O que vou fazer

### 1. Tratar o erro #100 de forma clara e automática
- Adicionar tradução do erro em `humanizarErroEnvio`: mensagem explicando que o número não está mais acessível pelo token/Business Manager e que é preciso reconectar a instância ou usar outra.
- Nas funções de envio (`send-whatsapp-meta`, `send-whatsapp-meta-text`, `send-whatsapp-meta-media`), ao detectar erro `code 100` / "does not exist ... missing permissions":
  - marcar a instância como **restrita** no pool com motivo `status=NUMERO_INACESSIVEL`, para que campanhas, lembretes e rodízio parem de usá-la na hora;
  - avisar o admin no WhatsApp uma única vez por número por dia, com orientação de reconectar.
- Rodar o diagnóstico da instância (função já existente) para registrar no card se o problema é token, número ou WABA.

### 2. Liberar respostas dentro da janela de 24h mesmo com qualidade YELLOW/RED
- Texto livre no Inbox já não é bloqueado por qualidade — vou manter e blindar isso.
- Nos envios feitos **de dentro de uma conversa com janela de 24h aberta** (mídia, áudio, documento e resposta com template a partir do Inbox), passar a ignorar bloqueios por qualidade/pausa por qualidade — continuam valendo apenas bloqueios reais da Meta (BANNED/FLAGGED/RESTRICTED, pendência de pagamento, número inacessível).
- O aviso amarelo "Qualidade da instância BAIXA" continua aparecendo, mas apenas como informação — nunca impedindo a resposta.
- Campanhas e disparos em massa seguem com as regras de qualidade atuais (sem mudança).

## Detalhes técnicos

- `src/lib/humanizarErroEnvio.ts`: nova regra para `#100` / "does not exist" / "missing permissions" (antes do fallback e sem colidir com a regra de template inexistente).
- `supabase/functions/send-whatsapp-meta/index.ts`, `send-whatsapp-meta-text/index.ts`, `send-whatsapp-meta-media/index.ts`: helper compartilhado novo em `_shared/` para detectar erro `100` da Graph, atualizar `meta_whatsapp_instances` (`estado_pool='restrita'`, `pausa_automatica_motivo='status=NUMERO_INACESSIVEL'`) e chamar `notificarAdmin` com chave idempotente diária.
- Gate de qualidade: nas respostas do Inbox com janela aberta, enviar `ignorar_pausa_qualidade: true` (mesma flag já usada pelo modo rajada), sem afetar `pick-meta-instance` nem o freio de qualidade das campanhas.
- Sem migração de banco e sem novo cron — nenhum aumento de custo no Cloud.

## Ação sua na Meta

Para esse número voltar a enviar, é preciso reconectar/reautorizar **SOUZA 62 8268-4387** no Business Manager (verificar se o número ainda está no WABA e se o app ainda tem permissão) e atualizar token/phone number ID no card da instância. Enquanto isso, o sistema vai rotear os envios para os outros números automaticamente.
