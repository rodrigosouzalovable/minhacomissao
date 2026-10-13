# Aviso de inatividade no WhatsApp do administrador

## Objetivo
Quando um funcionário que bate ponto passar 10 minutos sem mexer no sistema (o mesmo momento em que aparece o aviso flutuante na tela dele), enviar uma mensagem ao WhatsApp 62991672674.

## Mensagens
1. Ao completar 10 minutos parado:
   "Funcionário *Nome* está há 10 minutos sem mexer no sistema (desde 14:32, página Acordos)."
2. Quando ele voltar a mexer, um segundo aviso com o tempo total:
   "Funcionário *Nome* voltou ao sistema após 27 minutos parado."

## Regras
- Vale só para quem precisa bater ponto, nunca admin ou gestor, e só com a exigência de ponto ligada (mesmas regras do aviso flutuante atual).
- Aba do sistema fechada ou oculta não conta como inatividade (comportamento atual mantido).
- No máximo uma mensagem de início e uma de retorno por período de inatividade, sem repetição.
- Domingos não geram aviso.
- Falha no envio nunca atrapalha o uso do sistema.
- Usa o mesmo envio de notificações já usado nos avisos de ponto (rodízio e intervalos existentes).

## Detalhes técnicos
- Na função `ponto-atividade-heartbeat`: ao abrir a janela em `atividade_inatividade`, buscar `profiles.nome` e chamar `enqueueAdminNotification` com chave `inatividade:{janela_id}:inicio`; ao fechar a janela, enviar com chave `inatividade:{janela_id}:fim` incluindo `duracao_seg`. Ignorar fechamentos com duração abaixo de 10 min.
- Nenhuma mudança no navegador, sem novo cron, polling ou canal em tempo real.
- Atualizar a memória do módulo de ponto.

## Impacto de custo
Baixo: até duas mensagens por período real de inatividade, apenas reaproveitando a chamada que já acontece hoje.
