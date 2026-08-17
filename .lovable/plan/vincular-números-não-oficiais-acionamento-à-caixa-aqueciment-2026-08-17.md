# Vincular números não oficiais (Acionamento) à caixa AQUECIMENTO do Inbox Meta

## Objetivo
Os números conectados via UAZAPI na aba **Acionamento → Configurações** passam a aparecer e operar dentro da caixa **AQUECIMENTO** do Inbox Meta Oficial, com o IAGO respondendo automaticamente as mensagens que chegarem nesses números — exatamente como ele já faz nas instâncias oficiais.

## Como vai funcionar

1. **Espelhamento automático das instâncias**
   Cada número ativo em Acionamento (hoje 10 ativos de 12) ganha um registro "espelho" na lista de instâncias do Inbox Meta, marcado como **Não oficial (UAZAPI)** e já vinculado à caixa AQUECIMENTO.
   Ao adicionar/ativar um novo número em Acionamento, ele aparece na caixa AQUECIMENTO na hora, sem ação manual. Ao desativar/excluir, o espelho é desativado.

2. **Mensagens recebidas entram na caixa AQUECIMENTO**
   O webhook que já recebe as mensagens desses números passa a registrar a conversa também no Inbox Meta (contato + mensagem), sempre com a caixa AQUECIMENTO. Grupos e status continuam bloqueados.

3. **IAGO atende a caixa**
   Assim que a mensagem entra, o IAGO é acionado com as mesmas regras atuais (histórico da conversa, proposta, data de pagamento, falecimento/número errado, follow-ups, etiquetas, avisos ao humano). O plantão da caixa AQUECIMENTO ficará ativo 24h (não existe janela de 24h como na API oficial).

4. **Respostas manuais também funcionam**
   Responder pelo Inbox Meta (texto, áudio, mídia, respostas rápidas) em uma conversa dessa caixa envia pela UAZAPI do número correspondente, de forma transparente.

## Detalhes técnicos

- **Banco**: em `meta_whatsapp_instances`, adicionar `provider` ('meta' | 'uazapi', default 'meta'), `uazapi_instance_id` (FK → `user_whatsapp_instances`) e `folder_padrao_id` (FK → `meta_inbox_folders`); relaxar `NOT NULL` de `access_token`, `phone_number_id`, `waba_id` para permitir espelhos. Índice único parcial em `uazapi_instance_id`.
- **Sincronização**: trigger `AFTER INSERT/UPDATE/DELETE` em `user_whatsapp_instances` que cria/atualiza/desativa o espelho com `provider='uazapi'`, `folder_padrao_id = AQUECIMENTO (4f7a52c0-…)`, `display_phone` = telefone da instância; backfill dos números já conectados na mesma migration.
- **Entrada**: em `whatsapp-chatbot` (webhook UAZAPI), após gravar em `whatsapp_mensagens`/`whatsapp_contatos`, espelhar em `meta_whatsapp_contatos` (upsert por instância+telefone, `folder_id` = `folder_padrao_id`) e `meta_whatsapp_mensagens`, e então invocar `iago-atendimento` reusando o mesmo bloco de decisão do `meta-whatsapp-webhook` (dedupe por `whatsapp_msg_id`, ignorar grupos/status, ignorar `fromMe`).
- **Saída**: `send-whatsapp-meta-text` e `send-whatsapp-meta-media` detectam `provider='uazapi'` e roteiam para `server_url` + `instance_token` (`/send/text`, `/send/media`), gravando o log em `meta_whatsapp_mensagens` (e em `whatsapp_mensagens` para manter a aba Acionamento coerente). Assim `enviarTexto` do `_shared/iago.ts` e o Inbox Meta funcionam sem alteração.
- **Regras específicas**: para `provider='uazapi'`, ignorar janela 24h, templates HSM, qualidade/tier e rampup; manter delays randomizados existentes.
- **UI**: badge "Não oficial" no seletor de instância e no topo da conversa; `MetaFolderAcessoDialog`/config da caixa ganha o indicador de que os números do Acionamento estão vinculados.

## Custo (Lovable Cloud)
Sem novo cron, polling ou canal Realtime. O impacto é apenas de escrita duplicada por mensagem recebida/enviada nesses números (2 inserts extras por mensagem) e chamadas ao IAGO proporcionais ao volume de respostas — o disparo em massa para essa base aumentará o consumo de IA do IAGO na proporção das respostas recebidas.
