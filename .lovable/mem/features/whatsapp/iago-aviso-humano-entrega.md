---
name: Entrega dos avisos do IAGO (escalada para humano)
description: Avisos de negociação fechada/escalada do IAGO — validação real da resposta do provedor, fallback Meta oficial, painel interno no Inbox e reenvio de pendentes
type: feature
---

- `notificar-admin.ts` avalia a resposta do provedor por JSON (campos `error`, `success:false`, `code>=400`); nunca marcar erro só por conter a palavra "error" — respostas de sucesso trazem blocos `new_chat_message_capping`/`reachout_timelock`.
- `erro_detalhe` é gravado com até 1000 caracteres por tentativa (diagnóstico real).
- Ordem de entrega: instâncias UAZAPI conectadas (round-robin) → fallback pela API Oficial da Meta (`send-whatsapp-meta-text`, só se houver janela de 24h com o número do admin).
- `avisarEmergencia` sempre grava um registro interno `tipo='iago_humano_painel'` em `admin_notificacoes_log` — o aviso nunca depende da entrega no WhatsApp.
- UI: sino "Negociações do IAGO" (`src/components/inbox/meta/AvisosIagoBell.tsx`) no topo do Inbox Meta Oficial, admin-only, carrega ao abrir (sem polling).
- `iago-avisos-reenviar` (sem cron, chamada manual) reenvia avisos `tipo='iago_humano'` com status erro das últimas N horas, ignorando os que já foram entregues.
- Erro `WHATSAPP_REACHOUT_TIMELOCK` (provider 463) = restrição temporária do WhatsApp no chip; não é bug do sistema, só o painel interno/fallback garantem o aviso.
