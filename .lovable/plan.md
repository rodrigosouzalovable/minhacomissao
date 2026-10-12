# Mostrar só instâncias ativas e aplicar o template onde falta

## O que foi verificado
- Para o template **acesse_o_portal_de_negociacao**, a lista de pendências mistura números saudáveis com números **banidos** (dezenas com status BANNED e pausa automática), que hoje continuam marcados como ativos.
- Existem **36 números conectados, sem pausa e sem bloqueio** em que o modelo está **ausente e nunca entrou na fila**. Por isso não foi aplicado (inclui números como os da BM Shooni Med).
- Outros já estão em análise na Meta ou aguardando o intervalo gradual / limite diário do tier 250.

## Alterações
1. **Lista só com instâncias aptas**: no aviso "Este template não está aprovado em N instância(s)" e no botão "Selecionar instâncias aprovadas", considerar apenas números ativos, conectados e sem banimento, restrição, bloqueio de pagamento ou pausa por bloqueio real. Banidos/bloqueados saem da contagem e da seleção (podem aparecer num resumo recolhido "X ignorados: banidos/bloqueados").
2. **Aplicação automática dos faltantes**: aplicar este template agora nos números aptos onde está ausente, pela fila já existente, sem repetir os aprovados, em análise ou já na fila.
3. **Ritmo seguro mantido**: 2–5 minutos aleatórios por número e por BM, 24/7, limite de 2 por dia no tier 250. Ou seja, os 36 entram gradualmente, não todos de uma vez.
4. **Status claro por número**: Ausente, Na fila (com motivo da espera), Em análise, Aprovado, Rejeitado.
5. **Shooni Med**: confirmar após a correção que os números dessa BM entraram na fila; se algum for recusado pela Meta, mostrar o motivo.

## Fica igual
- Bloqueios reais da Meta não são contornados; YELLOW/RED seguem as regras atuais.
- Entrar na fila não é aprovação imediata; a Meta decide.
- Sem novo agendamento ou consulta recorrente (sem aumento de custo).

## Detalhes técnicos
- Filtro de elegibilidade compartilhado (reutilizar `meta-template-eligibility.ts`) aplicado ao catálogo/aviso de `EnvioMeta` e à seleção: excluir `saude_status='BANNED'`, `saude_ban_info`, `pausa_automatica_motivo` fatal e instâncias inativas/desconectadas.
- Enfileirar via `meta-templates-onboarding-enfileirar` (mestre específico) para os 36 aptos ausentes, com `ignoreDuplicates`.
- Teste: banido/pausado não conta como pendente; apto ausente é enfileirado uma única vez.
