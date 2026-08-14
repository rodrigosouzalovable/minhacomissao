---
name: Plantão do IAGO por caixa
description: Janela horária por caixa do Inbox Meta em que o IAGO assume todos os novos clientes em vez do rodízio de atendentes
type: feature
---

Tabela `meta_inbox_folder_iago_janela` (folder_id PK, sentinela `00000000-0000-0000-0000-000000000000` = caixa Padrão): `ativo`, `hora_inicio` (17:00), `hora_fim` (08:00), `fim_semana_24h` (true).

- Dentro da janela (horário de Brasília, aceita virar a madrugada) ou sábado/domingo com `fim_semana_24h`, o `meta-whatsapp-webhook` aplica a etiqueta do IAGO na conversa nova em vez de chamar `atribuir_atendente_rodizio`.
- Etiqueta de acordo do operador continua com prioridade sobre o plantão.
- Se a etiqueta do IAGO não estiver elegível na caixa (não é responsável), cai no rodízio normal.
- UI: botão direito na caixa > Configurar caixa > bloco "Plantão do IAGO" (`MetaFolderConfigDialog.tsx`).
- Conversa ANTIGA (já com etiqueta de humano): se o cliente responder dentro do plantão, o IAGO assume temporariamente — a etiqueta humana é guardada em `iago_plantao_transferencia` (contato_id PK, etiqueta_original_id, devolvido_em) e substituída pela do IAGO (`origem='plantao_iago'`).
- `iago-atendimento` detecta transferência ativa e zera `aguardando_humano`, usando `assumido_em` como corte (mensagens antigas do humano não silenciam o IAGO).
- `iago-plantao-devolver` (cron 11:05 UTC = 08:05 BRT) devolve a etiqueta original quando o plantão da caixa não está mais ativo.
