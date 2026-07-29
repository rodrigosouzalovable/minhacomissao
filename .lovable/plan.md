## Problema (confirmado no código)

O badge do card vem da coluna `webhook_saude_status` de `meta_whatsapp_instances`, gravada **apenas** pela função agendada `meta-webhook-health`.

O botão "Webhook" do card (`reinscreverWebhook` em `src/pages/ConfigurarMeta.tsx`) chama `meta-subscribe-waba`, mostra o toast "Webhook inscrito — mensagens recebidas passarão a aparecer no Inbox" e **não grava nada no banco** nem recarrega a lista. Por isso o valor antigo `erro` continua exibido mesmo com o webhook já funcionando.

## Correção

Em `src/pages/ConfigurarMeta.tsx`, na função `reinscreverWebhook`, quando `subscribe_ok` for verdadeiro:

1. Atualizar a instância no banco:
   - `webhook_saude_status = 'reinscrito'`
   - `webhook_saude_verificado_em = agora`
   - `webhook_ultimo_erro = null`
   - `webhook_perda_suspeita = null`
   - `webhook_callback_url` = URL de callback confirmada retornada pela função
2. Atualizar o estado local da lista (ou chamar `carregar()`) para o badge trocar na hora, sem precisar recarregar a página.
3. Manter o toast atual de sucesso.

Mesmo tratamento no fluxo de auto-inscrição após "adicionar instância", para novos cards nascerem com o status correto.

Em caso de falha, nada muda: continua o toast de erro e o badge vermelho.

## Detalhe técnico

- O badge já possui o estado `reinscrito` mapeado (rótulo azul "Webhook reinscrito"), então nenhuma mudança de UI de rótulo é necessária — só passar a gravar esse valor.
- Nenhuma alteração de schema, migration ou edge function é necessária.
- A cron `meta-webhook-health` continua sobrescrevendo o status na próxima verificação; se o callback estiver correto ela grava `ok` (verde), o que é o comportamento desejado.
