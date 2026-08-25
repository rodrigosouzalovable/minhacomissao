# Corrigir valor à vista na mensagem gerada (Layout Novo Mundo)

## Diagnóstico

O modelo salvo no seu usuário usa a variável `{valor_avista}` (mesmo nome usado no Layout UME), mas o renderizador do Layout Novo Mundo só reconhece `{valor_quitacao}`. Como `{valor_avista}` não existe na lista de variáveis reconhecidas, ela é mantida literalmente no texto — é exatamente o que aparece na sua tela: `✅ *À VISTA:* R$ {valor_avista}`. O bloco parcelado (`{opcoes_parcelado}`) funciona, o que dá a impressão de que "só aparece o parcelado".

O mesmo vale para `{nome_cliente}`, que também é citado na linha de ajuda mas não é substituído.

## O que muda

1. Passam a ser aceitas como sinônimos do valor à vista (total com o desconto à vista aplicado):
   - `{valor_avista}`, `{valor_a_vista}`, `{valor_vista}` → mesmo resultado de `{valor_quitacao}`.
2. `{nome_cliente}` passa a ser reconhecido como sinônimo de `{nome}`.
3. Nada mais muda: percentuais de desconto à vista e parcelado continuam vindo dos campos "% à vista" e "% parcelado", e a mensagem gerada segue atualizando na hora após a extração.

Resultado: com desconto à vista de 40% sobre R$ 647,02, a linha sai como `✅ *À VISTA:* R$ 388,21`, e o bloco parcelado segue calculado sobre o desconto parcelado.

## Detalhes técnicos

- `src/lib/parseCobmaisPlanilha.ts`, função `renderMensagem`: acrescentar no `map` as chaves `{valor_avista}`, `{valor_a_vista}`, `{valor_vista}` apontando para `fmtBRL(valorQuitacao)` e `{nome_cliente}` apontando para `toTitleCasePt(cliente.nome)`. O regex de substituição `\{[a-z_]+\}` já cobre esses nomes.
- Sem alterações de banco, edge functions ou UI.
