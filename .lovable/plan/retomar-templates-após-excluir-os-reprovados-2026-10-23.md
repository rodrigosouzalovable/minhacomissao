# Retomar templates após excluir os reprovados

## Causa
Quando um número acumula reprovações seguidas, o sistema marca a fila como "pausada por reprovações". Essa marca nunca é removida: mesmo depois de você excluir os reprovados na BM, o botão **Aplicar templates** continua recusando com "fila pausada por reprovações".

## Correção
1. Ao clicar em **Templates → Aplicar templates**, o sistema primeiro sincroniza os templates do número com a Meta.
2. Se a sincronização funcionar e não houver mais templates rejeitados no número, a pausa é removida automaticamente (zera o contador de reprovações e a pausa temporária) e a aplicação segue normalmente, só com os templates que faltam.
3. Se ainda existirem rejeitados, a mensagem passa a dizer quantos e quais, orientando excluí-los na BM antes de tentar de novo.
4. Se a consulta à Meta falhar, a pausa é mantida e a mensagem explica que não foi possível conferir (nunca libera por suposição).
5. A etiqueta "Templates aprovados · pausado" some do cartão após a liberação.

## Proteções mantidas
Bloqueios reais da Meta, qualidade RED/YELLOW, limite diário do tier e a não duplicação de templates existentes continuam valendo. Só números próprios autorizados.

## Detalhes técnicos
- `meta-templates-onboarding-enfileirar`: no fluxo manual de uma instância com `templates_auto_status = PAUSADO_REJEICOES`, chamar `sincronizarTemplatesMeta`; se `success` e nenhuma linha `rejected` em `meta_whatsapp_templates`, atualizar `templates_auto_status = null`, `templates_auto_rejeicoes_seguidas = 0`, `templates_auto_pausado_ate = null` antes da checagem de elegibilidade. Remover linhas locais de templates que não vieram mais da Meta (excluídos na BM) apenas quando a sync foi completa.
- `ConfigurarMeta.tsx`: exibir o motivo retornado (lista de rejeitados) e recarregar a instância.
- Teste: pausa liberada só com sync completa e zero rejeitados; mantida com rejeitado restante ou falha na sync.

## Custo
Sem novo agendamento ou polling; uma consulta à Meta por clique manual.
