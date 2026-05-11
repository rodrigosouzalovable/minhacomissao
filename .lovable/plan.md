## Objetivo
Desativar TODOS os módulos de aquecimento (envios diretos, conversas em grupo, engajamento em status de outros, completar perfil, descoberta de grupos, promoção de fase, IA ping-pong) e manter ativa APENAS a **postagem automática de status** nos próprios chips. Em seguida, postar imediatamente uma imagem do pool no status da instância **62982115479 MEMU 37 02/05** como confirmação.

## Motivo
Alguns números foram restringidos/banidos sem terem enviado mensagens. Reduzir a superfície de risco mantendo apenas a atividade mais "passiva" e natural (status/stories), que historicamente não dispara banimentos.

## O que será desligado
Todos via flags em `whatsapp_aquecimento_config` (chave/valor):
- `aquecimento_pausado` = true (mestre — derruba envio autosave + grupo conversa + IA ping-pong)
- `engajamento_status_auto` = false (zera visualizações/reações/respostas em status alheios)
- `grupo_conversa_habilitado` = false
- `perfil_completacao_auto` = false
- `descoberta_grupos_auto` = false
- `promocao_fase_auto` = false
- `ia_pingpong_habilitado` = false (se existir)

Cron jobs continuam disparando, mas cada edge function checa a flag e retorna `skipped`. Custo Lovable Cloud: ~zero (apenas no-op de cron).

## O que permanece ativo
- `postar_status_auto` = true (já é o padrão)
- `status_habilitado` = true
- Cron `whatsapp-aquecimento-status` continua rodando: cada chip posta a cada 48-72h, janela 09-19h BRT, nunca aos domingos, sem repetir as últimas 3 imagens.

## Teste imediato (instância MEMU 37)
1. Resolver `instancia_id` via `user_whatsapp_instances` onde `nome ILIKE '%62982115479%'` ou `%MEMU 37%`.
2. Invocar `whatsapp-aquecimento-status` com `{ action: "test", instancia_id: "<id>" }` — isso ignora cooldown, janela horária e domingo.
3. Validar resposta: `ok: true`, `results[0].ok = true` e `msgId` retornado.
4. Conferir registro novo em `whatsapp_aquecimento_status_log` com `status='enviado'`.
5. Como engajamento foi desativado, NÃO serão agendadas visualizações/reações de outros chips nesse status (comportamento esperado e desejado para reduzir risco).

## Validação pós-implementação
- `select chave, valor from whatsapp_aquecimento_config where chave in (...)` mostra todas as flags corretas.
- Logs de `aquecimento-envio-autosave`, `aquecimento-grupo-conversa`, `aquecimento-status-reagir` mostram `skipped: paused/disabled` na próxima execução.
- Log de `whatsapp-aquecimento-status` mostra postagem bem-sucedida do MEMU 37.

## Detalhes técnicos
- Atualização das flags via `supabase.from('whatsapp_aquecimento_config').upsert(...)` (sem migração — são linhas de configuração, não schema).
- `whatsapp-aquecimento-status` já suporta modo teste manual (linhas com `isManualTest`), portanto não precisa alterar código de edge function.
- Nenhum arquivo do frontend será modificado nesta etapa; o usuário pode reativar módulos individualmente pelas abas existentes em `/aquecimento` quando quiser.

## Reversão
Para retomar qualquer módulo: voltar a flag correspondente para `true`/`false` invertido na aba de configuração, ou eu faço sob comando.
