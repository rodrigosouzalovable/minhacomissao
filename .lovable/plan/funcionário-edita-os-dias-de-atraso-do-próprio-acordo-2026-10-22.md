# Funcionário edita os dias de atraso do próprio acordo

## O que muda
- Na tela **Editar** de um acordo que o próprio funcionário lançou, o campo **Dias em Atraso** fica liberado.
- Ao salvar, o percentual de comissão é recalculado automaticamente pela regra atual de faixas de atraso, e a comissão de todas as parcelas (pendentes e pagas) e o total de comissão do acordo são atualizados.
- O funcionário continua sem escolher o percentual à mão e sem mudar o operador. Acordos de outros operadores seguem bloqueados. Admins não mudam.
- Útil para corrigir os acordos lançados com "1 dia" provisório.

## Detalhes técnicos
- Nova migração: `editar_acordo_proprio_completo` ganha `p_dias_atraso` (0–9999), valida dono, recalcula `percentual_comissao` no servidor com a mesma tabela de `calcularPercentualComissaoMundoDaModa`, atualiza `comissao_parcela` de todos os pagamentos e `comissao_total`, atomicamente. O trigger de proteção (que bloqueia `dias_atraso`/`percentual_comissao`) passa a aceitar a mudança só dentro dessa operação.
- `EditarAcordo.tsx`: habilitar o campo no fluxo do dono, mostrar a comissão prevista e enviar o valor na RPC.
- Teste em `tests/` para o percentual por faixa de dias.
- Sem custo extra.

## Validação
- Como funcionário, alterar dias de atraso de um acordo próprio e conferir percentual e comissões; tentar em acordo alheio e ver recusa.
