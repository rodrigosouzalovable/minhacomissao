# Suspender Aquecimento entre Números

## Objetivo
Pausar imediatamente toda conversa automática **entre os WhatsApps** (que está causando bloqueios), mantendo a estrutura intacta para reativar depois quando você definir o grupo único.

## O que será SUSPENSO

1. **Cron `aquecimento-auto-horario-economico`** (a cada hora, 11h-23h UTC) → dispara `whatsapp-aquecimento` (motor ping-pong entre instâncias).
2. **Cron `aquecimento-autosave-horario`** (a cada hora) → dispara `aquecimento-envio-autosave` (envios para âncoras + pool de 985).
3. **Cron `aquecimento-promocao-fase-diaria`** (06h diário) → promoção de fase (sem envios, mas inútil sem o motor; pausar evita mudanças de status indevidas).
4. **Flag `aquecimento_habilitado`** em `whatsapp_aquecimento_config` → setar `false` como trava redundante (mesmo se algo disparar manualmente, o motor recusa).
5. **Botão de teste manual no Dashboard de Aquecimento** → adicionar aviso visual "PAUSADO — nova estratégia em definição" e desabilitar o disparo manual.

## O que CONTINUA funcionando

- **Status Auto** (postagem de status a cada 48-72h) → mantém aquecimento "passivo" via stories, sem risco de ban por troca de mensagens.
- **Grupo de Aquecimento** (cadastro e UI) → preservado, será reaproveitado quando você ativar a nova estratégia.
- **Inbox, robôs de cobrança, lembretes, campanhas** → sem qualquer impacto.
- **Tabelas, logs, configurações, pool de mensagens, âncoras** → tudo preservado.

## Como reativar depois (futuro)

Quando você terminar de limpar os grupos e definir o grupo único, basta me pedir "reativar aquecimento via grupo único". Eu então:
- Religo os crons (ou crio nova versão focada em grupo).
- Reescrevo o motor para enviar **apenas para o JID do grupo cadastrado** em vez de DMs entre instâncias.
- Mantenho limites diários e horário comercial.

## Detalhes técnicos

- Migration usando `cron.unschedule('nome')` para os 3 jobs acima (idempotente, com `IF EXISTS` lógico via DO block).
- `UPDATE whatsapp_aquecimento_config SET aquecimento_habilitado = false`.
- Edit em `src/components/aquecimento/AquecimentoDashboard.tsx` (ou similar) adicionando banner âmbar "Aquecimento entre números PAUSADO" no topo.
- **Não** mexer em: `whatsapp-aquecimento-status` (cron `aquecimento-status-30min`), `add-to-warming-group`, tabelas de log.
- Atualizar memória `mem://features/whatsapp/warming-system-comprehensive` marcando estado como SUSPENSO.

## Fora de escopo
- Apagar grupos de WhatsApp (você está fazendo manualmente).
- Implementar o modo "grupo único" agora.
- Remover código/tabelas do sistema atual.
