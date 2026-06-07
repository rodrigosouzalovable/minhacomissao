## 1. Desativar relatório de aquecimento no WhatsApp

O resumo diário de aquecimento (20h BRT, imagem 1) é disparado por cron chamando a edge function `daily-report-aquecimento`.

- Remover o cron job que invoca `daily-report-aquecimento` (via migração que faz `cron.unschedule` do job correspondente).
- Manter a edge function existindo (sem alterações), apenas sem agendamento — assim pode ser religada no futuro se necessário, sem perda de código.

## 2. Lembrete de boleto: incluir "Número que falou com o cliente" + botão "Boleto Enviado"

Edge function: `supabase/functions/notificar-boletos-pendentes/index.ts`.

### 2a. Texto da mensagem
- Buscar `acordos.observacoes` (campo já preenchido no Novo Acordo como "Número que falou com o cliente").
- Se houver valor (não vazio), adicionar linha entre o lembrete e o aviso final:
  `Número que falou com o cliente: <observacoes>`
- Se vazio/nulo, não incluir a linha.

### 2b. Envio com botão
- Trocar a chamada de `send-whatsapp` por `send-whatsapp-buttons` (já existente) com:
  - `texto` = mensagem montada acima
  - `choices` = `["Boleto Enviado"]`
  - `footerText` = "Clique abaixo após enviar o boleto"
- Continuar gravando em `notificacoes_envios_log` igual hoje (sucesso/erro, dedup por pagamento+tipo+data).
- Manter delay randômico 30-90s entre envios e bloqueio de domingo.

### 2c. Captura do clique (ação do botão)
Quando o operador tocar em "Boleto Enviado", o UAZAPI envia a resposta como mensagem comum vinda do telefone do operador. Para marcar o acordo como `boleto_enviado=true` automaticamente:

- Em `uazapi-webhook/index.ts`, adicionar um handler leve: se a mensagem recebida (texto puro ou `buttonOrListid`) for exatamente `"Boleto Enviado"` e o remetente bater com algum `notificacoes_operador_telefone.telefone` (match por sufixo de 8 dígitos, padrão do projeto), localizar o último `notificacoes_envios_log` enviado para esse operador nas últimas 48h, pegar o `pagamento_id` → `acordo_id` e atualizar `acordos.boleto_enviado = true`.
- Responder ao operador com confirmação curta via `send-whatsapp` ("✅ Boleto marcado como enviado — acordo de <cliente>").
- Se houver múltiplos lembretes pendentes do mesmo operador, marcar o mais recente e pedir para o operador especificar o CPF caso aplicável (mensagem de orientação).

## Verificação

- Rodar `notificar-boletos-pendentes` com `dryRun:true` e conferir o texto montado com/sem observações.
- Rodar real em um acordo de teste com `observacoes` preenchido — operador deve receber mensagem com a linha extra e botão "Boleto Enviado".
- Tocar no botão e verificar `acordos.boleto_enviado` virou `true` + confirmação no WhatsApp.
- Confirmar via `cron.job` que `daily-report-aquecimento` não está mais agendado e que o resumo das 20h não chega mais.

## Fora de escopo

- Alterações no relatório diário geral (19h) — só o de aquecimento é desativado.
- Mudanças na UI de Novo Acordo (campo "Número que falou com o cliente" já existe e é salvo em `observacoes`).
