

# Corrigir envio real de WhatsApp pelo Dialog de Lembretes

## Problema identificado

O fluxo atual tem 2 falhas críticas:

1. **Mensagens não são enviadas**: O `check-payment-reminders` agenda as mensagens na fila com `agendado_para` escalonado em 5-7 minutos no futuro. Quando o `process-whatsapp-queue` é chamado logo em seguida, ele filtra por `agendado_para <= agora`, então apenas a primeira mensagem pode ser processada - as demais estão agendadas para o futuro e o loop termina imediatamente com "Envio finalizado".

2. **Delay incorreto**: O delay do lado do cliente é de 5-7 **segundos**, mas o usuário quer 5-7 **minutos**.

3. **Sem round-robin entre instâncias**: Quando múltiplas instâncias são selecionadas, todas as mensagens são duplicadas para cada instância ao invés de distribuir.

## Solução

Mudar a abordagem: em vez de usar `check-payment-reminders` + `process-whatsapp-queue` (projetados para cron jobs), o dialog vai enviar diretamente usando `send-whatsapp`, controlando o fluxo do lado do cliente.

### `src/components/PaymentReminders.tsx`

Reescrever `handleStartEnvios`:

1. Coletar todos os lembretes pendentes que possuem telefone
2. Para cada lembrete, na ordem da lista:
   - Selecionar a instância via round-robin (1ª mensagem = instância 1, 2ª = instância 2, volta para instância 1...)
   - Chamar `send-whatsapp` diretamente com `telefone`, `mensagem`, `uazapi_server_url` e `uazapi_instance_token`
   - Atualizar o badge para "Enviado" ou "Erro"
   - Aguardar delay aleatório de **5-7 minutos** (300.000-420.000ms)
3. Gerar a mensagem no cliente usando template padrão com as variáveis do lembrete (nome, valor, data)
4. Remover dependência de `check-payment-reminders` e `process-whatsapp-queue`

### Detalhes técnicos

- Round-robin: `instanceIndex = lembreteIndex % selectedInstances.length`
- Delay: `const delay = (5 + Math.random() * 2) * 60 * 1000` (5-7 min em ms)
- Mensagem gerada localmente com dados já disponíveis no lembrete (nome, telefone, valor_parcela, data_prevista)
- Template simples para cada tipo (vencido, hoje, 3 dias)

### Arquivos editados
- `src/components/PaymentReminders.tsx`

