# Terceira tabela na calculadora UME: "Sem Juros + 10%"

## O que muda

Na janela "Consulta UME — calculadora de desconto", ao lado de **Tabela Padrão** e **Desconto Especial**, entra um terceiro botão: **Sem Juros + 10%**.

Ao selecioná-lo, o sistema monta o parcelamento por conta própria:

1. Base de cálculo = **Total sem juros + 10%**.
   - Exemplo da imagem: R$ 2.361,00 → base R$ 2.597,10.
2. Opções geradas: **à vista (1x)**, **2x, 4x, 8x, 10x, 12x e 18x**, cada parcela = base ÷ nº de parcelas.
   - Exemplo: 2x R$ 1.298,55 · 4x R$ 649,28 · 8x R$ 324,64 · 10x R$ 259,71 · 12x R$ 216,43 · 18x R$ 144,28.
3. Parcela mínima R$ 100: opções cuja parcela ficaria abaixo de R$ 100 aparecem riscadas e não entram na proposta enviada ao cliente.
4. No cabeçalho da tabela, em vez de "Até 3x / 4x ou mais", aparece o valor da base (Total com +10%), já que essa tabela não tem os totais do relatório da UME.
5. **Copiar proposta** e **Enviar na conversa** funcionam igual às outras duas tabelas, usando os valores dessa nova tabela (à vista em destaque + lista de parcelas válidas).

Se o Total sem juros não vier na consulta, o botão fica desabilitado com aviso de que não há base para o cálculo.

Nada muda nas tabelas Padrão e Desconto Especial, nem no comportamento do IAGO.

## Detalhes técnicos

- Arquivo único: `src/components/inbox/meta/ConsultaUmeDialog.tsx`.
- Novo estado de aba: `tabela: 'padrao' | 'especial' | 'sem_juros_10'`.
- Função local `tabelaSemJuros10(consulta)` retorna `{ parcelas: [1,2,4,8,10,12,18], base }` calculada a partir de `consulta.valorSemJuros * 1.1`, arredondada em centavos.
- `textoProposta` passa a aceitar a nova opção, reutilizando a mesma formatação e o filtro `valorParcela >= 100`.
- Sem alteração de banco, edge functions ou cache; o cálculo é local e não gera consulta extra.
