---
name: Copiloto de objeções no Inbox
description: Sugestões de resposta geradas por IA quando o cliente traz objeção no Inbox Meta Oficial, com catálogo que aprende por conversão
type: feature
---

Quando a última mensagem da conversa é do cliente e um detector local (regex, sem IA) identifica objeção (sem_condicoes, caro, vou_pensar, mes_que_vem, desconfianca), aparece um card discreto acima do campo de digitação com 3 sugestões prontas ("Usar" joga no composer, "Copiar", "Gerar outras"). Botão de lâmpada no cabeçalho da conversa abre/fecha manualmente.

- Uma chamada de IA por mensagem do cliente, com cache em `objecao_sugestoes_log` (único por instancia_id+telefone+mensagem_id). Nada roda em webhook nem em background.
- Function `sugerir-resposta-objecao`: últimas 20 mensagens + credor + catálogo vencedor no prompt; nunca inventa valores (usa só o que já foi enviado); parcela mínima R$ 100.
- Function `objecao-aprender` (cron diário 06:45 UTC): fecha logs pendentes (acordo > respondeu > sem_retorno), atualiza usos/conversoes/score do `objecao_catalogo`, apaga sugestões nunca usadas com +14 dias e consolida modelos com origem `aprendizado`.
- Admin: aba "Objeções" em Usuários > Configurar IAGO (`src/components/admin/ObjecoesCatalogoTab.tsx`) — editar, fixar, desativar, excluir e recalcular.
