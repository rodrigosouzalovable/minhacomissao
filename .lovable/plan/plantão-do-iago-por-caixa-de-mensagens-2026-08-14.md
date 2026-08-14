# Plantão do IAGO por caixa de mensagens

Novo campo em **Configurar caixa** (botão direito na caixa de mensagens do Inbox Meta Oficial) para definir o horário em que o IAGO assume automaticamente todos os novos clientes daquela caixa.

## Como vai funcionar

- Bloco "Plantão do IAGO" no diálogo Configurar caixa, com:
  - Liga/desliga do plantão.
  - Hora de início e hora de fim (padrão 17:00 → 08:00, virando a madrugada).
  - Chave "Sábado e domingo 24h" (ligada por padrão).
- Dentro da janela configurada (horário de Brasília), toda conversa nova que chegar naquela caixa recebe a etiqueta `Atendente: IAGO Ribeiro de Souza` em vez de entrar no rodízio dos atendentes humanos — e o IAGO responde normalmente.
- Fora da janela, o rodízio dos humanos continua igual.
- Cliente que já tem acordo lançado continua indo para a etiqueta do operador dele (essa regra tem prioridade sobre o plantão).
- Conversa que o IAGO pegou no plantão permanece com a etiqueta dele depois das 08h — ele segue o atendimento até escalar para "Aguardando Humano" ou um atendente escrever na conversa.
- O IAGO só entra no plantão se estiver marcado em "Atendentes desta caixa"; se não estiver, nada muda.

## Detalhes técnicos

Banco (nova migração):
- Tabela `meta_inbox_folder_iago_janela`: `folder_id` (PK, sentinela `00000000-...` para a caixa Padrão), `ativo`, `hora_inicio` (default `17:00`), `hora_fim` (default `08:00`), `fim_semana_24h` (default true), timestamps + trigger de `updated_at`.
- GRANTs para `authenticated` e `service_role`, RLS habilitada, leitura/escrita para admin/gestor (mesmo padrão de `meta_inbox_folder_credores`).

Backend:
- `meta-whatsapp-webhook`: antes do trecho `atribuir_atendente_rodizio` (linha ~773), lê a janela da caixa do contato. Se o plantão está ativo e o momento atual em BRT está na janela (incluindo janelas que cruzam a meia-noite) ou é sábado/domingo com `fim_semana_24h`, aplica a etiqueta do IAGO (localizada por `Atendente: <nome do IAGO>` entre as etiquetas elegíveis) e ignora o rodízio; caso contrário mantém o comportamento atual. Se a etiqueta do IAGO não estiver entre as elegíveis daquela caixa, cai no rodízio normal.

Frontend:
- `src/components/inbox/meta/MetaFolderConfigDialog.tsx`: novo bloco com switch, dois `Input type="time"` e o switch de fim de semana, salvando via upsert em `meta_inbox_folder_iago_janela`.

Custo: sem cron novo e sem polling — apenas uma leitura extra por conversa nova no webhook.
