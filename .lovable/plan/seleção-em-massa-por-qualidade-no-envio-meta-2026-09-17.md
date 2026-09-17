# Seleção em massa por qualidade no Envio Meta

## Objetivo

Na janela **Envio Meta → Instâncias**, o botão **Selecionar todas** deve marcar somente instâncias com qualidade:

- **GREEN**;
- **desconhecida**, sem leitura ou sem qualidade informada.

Instâncias **YELLOW** e **RED** não serão incluídas pela seleção em massa.

## Comportamento

- YELLOW e RED continuarão visíveis e poderão ser marcadas ou desmarcadas manualmente por administradores e Parceiros Meta.
- Ao marcar manualmente YELLOW ou RED, o aviso e a confirmação de risco existentes continuam funcionando.
- **Limpar seleção** removerá todas as instâncias visíveis que estiverem marcadas, inclusive as escolhidas manualmente.
- Marcar ou desmarcar continuará sem ativar ou desativar o pool.
- Os botões separados **Ativar Pool**, **Retomar Pool** e **Desativar Pool** permanecem sem alterações.

## Alteração técnica

Ajustar somente a seleção em massa em `src/pages/EnvioMeta.tsx` para considerar elegíveis as qualidades `GREEN`, `UNKNOWN`, valor vazio ou sem leitura. `YELLOW` e `RED` ficam fora da lista adicionada pelo botão.

O estado do botão será calculado sobre esse mesmo conjunto elegível, evitando que YELLOW/RED impeçam a troca correta entre **Selecionar todas** e **Limpar seleção**.

## Impacto

Mudança apenas na interface, sem nova consulta, função, rotina automática ou aumento relevante de custo no Lovable Cloud.

## Verificação

- Confirmar que **Selecionar todas** marca GREEN e qualidade desconhecida.
- Confirmar que YELLOW e RED permanecem desmarcadas.
- Confirmar que YELLOW/RED ainda podem ser escolhidas manualmente.
- Confirmar que **Limpar seleção** limpa todas as escolhas visíveis.
- Confirmar que nenhuma ação de seleção altera o estado do pool.
