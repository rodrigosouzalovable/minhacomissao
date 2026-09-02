# Modelo Mensagem: mapeamento de colunas + credor nas abas de parcelamento

Aplica-se às abas **Layout Parcelamento** e **Layout à vista + parcelamento**.

## Novo fluxo de importação

1. Importar a planilha (.xlsx/.xls) como hoje.
2. Em vez de assumir A=nome, B=telefone, C=valor, aparece uma **pré-visualização de mapeamento** logo abaixo do arquivo, no mesmo estilo do Envio Meta:
   - Tabela com as primeiras ~10 linhas da planilha.
   - Acima de cada coluna, um seletor: Ignorar / Nome / Telefone / **Valor total devido**.
   - Detecção automática inicial pelo cabeçalho e pelo conteúdo (telefone, nome, valor), podendo ser corrigida manualmente.
   - Opção "primeira linha é cabeçalho" (marcada automaticamente quando detectada).
3. O botão **Aplicar** só funciona depois que Telefone e Valor total estiverem mapeados; o valor é lido apenas da coluna escolhida.
4. Linhas sem telefone ou sem valor válido continuam sendo descartadas, e duplicatas idênticas consolidadas.

## Seletor de credor

Novo campo **Credor** ao lado dos descontos, com duas opções:

- **Novo Mundo** (padrão): grade 2x, 4x, 8x, 12x, 16x, 20x, 24x — até 24x.
- **UME**: grade 2x, 4x, 8x, 10x, 12x, 18x — até 18x.

A regra de **parcela mínima de R$ 100,00** continua valendo: só entram as opções cuja parcela fique igual ou acima disso. Se nenhuma opção atender, a coluna Parcelamento mostra "Somente à vista".

O desconto à vista e o desconto parcelado seguem sendo definidos nos campos existentes (padrão 50% e 30% na aba à vista + parcelamento; 30% na aba de parcelamento).

## Exportação

O Excel baixado mantém as colunas atuais de cada aba (Parcelamento: Nome | Telefone | Parcelamento; À vista + parcelado: Telefone | Nome | Valor original | À vista | Parcelamento), agora calculadas a partir da coluna de valor escolhida e da grade do credor.

## Detalhes técnicos

- Novo componente compartilhado `src/components/modelo-mensagem/MapearColunasPlanilha.tsx`: recebe as linhas cruas (`any[][]`) e devolve o mapeamento `{ nome, telefone, valor }` + flag de cabeçalho. Heurísticas de detecção inspiradas em `MapearColunasImportDialog.tsx`, sem dependência de templates Meta.
- Novo helper `src/lib/gradeCredor.ts` (ou constantes em `src/lib/credorConfig.ts`) expondo `GRADE_POR_CREDOR = { novo_mundo: [2,4,8,12,16,20,24], ume: [2,4,8,10,12,18] }` e função `montarParcelamentoTexto(base, grade, minima)`; `PARCELA_MINIMA` continua vindo de `@/lib/parseCobmaisPlanilha`.
- `LayoutPlanilhaTab.tsx` e `LayoutVistaParcelamentoTab.tsx`: passam a guardar `rows` cruas, estado de mapeamento e credor; `montaParcelamento` passa a receber a grade do credor.
- Sem mudanças de banco de dados, backend ou lógica de envio.
