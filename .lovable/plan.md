# Nova leitura da planilha (Padrão e MMP Mundo da Moda)

Os layouts "Padrão" e "MMP Mundo da Moda" passam a ler a planilha por parcela, no formato:

| Coluna | Conteúdo |
| --- | --- |
| A | CPF (11 dígitos) |
| B | Nome do cliente |
| C | Credor |
| D | Número do contrato |
| E | Número da parcela |
| F | Vencimento da parcela |
| G | Valor da parcela |
| H | Valor total do débito (apenas conferência) |

## Comportamento

- Cada linha da planilha vira uma parcela do cliente, com descrição "Parcela N" e vencimento da coluna F.
- CPF com zeros à esquerda é preservado (completa até 11 dígitos); CNPJ até 14.
- Nome é normalizado (capitalização padrão do sistema).
- Credor: usa o "Credor de Destino" escolhido na tela; a coluna C é guardada como credor da linha quando o destino não é informado.
- Parcela sem número na coluna E recebe numeração automática pela ordem de vencimento dentro do mesmo CPF + contrato (mesma regra já usada no layout UME consolidado), evitando "Parcela 0" duplicada.
- Vencimento aceita data do Excel (serial numérico) e texto dd/mm/aaaa.
- Valor da parcela aceita "1.234,56", "1234.56" e "R$ 1.234,56".
- Coluna H: somente conferência — o preview mostra o total das parcelas lidas por CPF e sinaliza quando difere do valor informado em H (badge de divergência), sem alterar os valores gravados.
- Linhas sem CPF válido ou sem valor de parcela são ignoradas.

## Onde muda

- Texto de ajuda dos layouts "Padrão" e "MMP Mundo da Moda" atualizado para descrever as novas colunas A–H.
- Tabela de pré-visualização passa a mostrar Contrato, Parcela, Vencimento e Valor da parcela.
- O restante do fluxo (importação em lote, Modo Espelho, descontos do portal por credor) continua igual.

## Detalhes técnicos

- Em `src/pages/ImportarDevedores.tsx`: `parsePadrao` reescrito no modelo por parcela (base na lógica de `parseUmeConsolidado`), com `descricao = "Parcela N"` e a data em `nascimento` (campo já usado por `parseDate` no `handleImport`).
- Novo cálculo de conferência: mapa CPF → soma de G vs. valor de H (primeira ocorrência), exposto no preview.
- `LAYOUT_DESCRICOES` para `padrao` e `mmp` atualizado.
- Não há mudança de banco de dados.
