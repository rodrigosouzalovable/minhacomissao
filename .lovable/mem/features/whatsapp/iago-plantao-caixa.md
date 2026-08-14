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
