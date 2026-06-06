## Visão geral

Criar a aba **Notificações** (admin) com:
1. Conexão de um WhatsApp dedicado (QR Code) que envia lembretes internos.
2. Cadastro de **telefone de notificação por operador**.
3. Robô automático que, para cada parcela pendente cujo acordo **não foi marcado como "boleto enviado"**, envia lembrete ao operador responsável:
   - **14:00 BRT do dia anterior ao vencimento**
   - **09:00 BRT do próprio dia do vencimento** (se ainda não marcado)
   - Repete **uma vez por dia** até o operador marcar como enviado ou a parcela ser paga.
   - Bloqueado aos domingos (postergado para segunda 09:00 BRT, mantendo regra global do sistema).

## Banco de dados

Novas tabelas:

- `notificacoes_config` (singleton admin)
  - `instancia_id` (uuid → `user_whatsapp_instances`): WhatsApp usado para enviar lembretes.
  - `ativo` (bool, default true)

- `notificacoes_operador_telefone`
  - `user_id` (uuid, FK profiles, unique)
  - `telefone` (text) — guardado normalizado (13 dígitos 55+DDD+9).
  - `ativo` (bool default true)

- `notificacoes_envios_log` (dedup diário)
  - `pagamento_id`, `user_id`, `tipo` ('D-1' | 'D0'), `data_ref` (date), `enviado_em`
  - UNIQUE (`pagamento_id`, `tipo`, `data_ref`) — garante 1 envio/dia/tipo.

Todas com RLS + GRANTs:
- Admin: full access.
- Operador: SELECT do próprio `notificacoes_operador_telefone`.

## Frontend

Nova rota `/admin/notificacoes` (admin-only) com 3 seções:

1. **WhatsApp Notificador**
   - Seletor de instância entre `user_whatsapp_instances` ativas do admin.
   - Botão "Conectar via QR Code" reaproveitando o fluxo de `whatsapp-qr` já existente.
   - Status (conectado / desconectado).

2. **Telefones dos Operadores**
   - Lista todos os `profiles`/operadores.
   - Para cada um: input de telefone + toggle ativo + botão salvar.
   - Validação simples de telefone BR.

3. **Histórico recente**
   - Últimos 50 envios de `notificacoes_envios_log` com operador, tipo, parcela e horário.

Item adicionado ao menu lateral (`AppLayout.tsx`) com ícone `Bell`, `adminOnly: true`.

## Backend (Edge Function + Cron)

Nova edge function `notificar-boletos-pendentes`:
- Lê `notificacoes_config` ativa.
- Busca `pagamentos` onde:
  - `status = 'pendente'`
  - acordo correspondente com `boleto_enviado = false`
  - `data_prevista` = hoje (para tipo `D0`) **ou** amanhã (para tipo `D-1`), conforme horário de execução.
- Para cada parcela, obtém operador (`acordos.user_id`) e telefone em `notificacoes_operador_telefone` (ativo).
- Verifica `notificacoes_envios_log` para não duplicar no dia.
- Envia mensagem via instância configurada (`send-whatsapp` interno) com texto:
  > "Olá {nome}, lembrete: o acordo do cliente {cliente_nome} (CPF {cpf}) tem parcela vencendo em {data}. Não esqueça de enviar o boleto e marcar como 'Boleto Enviado' no sistema."
- Insere registro em `notificacoes_envios_log`.
- Respeita bloqueio de domingo (postergação Mon 09:00 BRT já presente como regra global).
- Delays randômicos 2–6s entre envios.

Cron via `pg_cron`:
- `0 14 * * *` (BRT 14h = 17 UTC) → roda em modo `D-1`.
- `0 9 * * *` (BRT 09h = 12 UTC) → roda em modo `D0`.

## Custos

Impacto baixo: 2 execuções/dia + 1 mensagem WA por parcela/operador. Sem novos secrets, sem novos provedores pagos — reutiliza UAZAPI e instâncias existentes.

## Fora de escopo

- Não altera UI/regras atuais de "boleto enviado" na aba Meus Acordos.
- Não cria notificações para outros eventos (pagamentos, retornos, etc.) — só boleto pendente.
- Não envia ao cliente — só ao operador interno.
