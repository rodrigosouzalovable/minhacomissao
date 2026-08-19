# Modelo Mensagem: renomear aba e criar "Layout à vista + parcelamento"

## 1. Renomear aba
"Layout Planilha" passa a se chamar **Layout Parcelamento**. Nenhuma mudança de comportamento — só o rótulo.

## 2. Nova aba: Layout à vista + parcelamento
Nova aba na mesma linha das outras (visível para admin), com:

- **Importar planilha** no mesmo formato já usado hoje: coluna A = nome, B = telefone, C = valor total em aberto. Aceita `.xlsx` / `.xls`, valores com ou sem `R$`, ponto/vírgula.
- **Dois campos de desconto**: "Desconto à vista (%)" (padrão 50) e "Desconto parcelado (%)" (padrão 30).
- **Botão Aplicar** que gera a pré-visualização.
- **Pré-visualização em tabela** com as colunas:
  - Telefone
  - Nome do cliente
  - Valor original
  - **À vista** — valor total já com o desconto à vista aplicado, formatado `R$ 797,79`
  - **Parcelamento** — as opções de parcelas calculadas sobre o valor com desconto parcelado, respeitando a grade de parcelas e a parcela mínima já usadas no sistema (ex.: `2x de R$ 450,00, 3x de R$ 300,00 ou 6x de R$ 150,00`)
- **Botão Baixar Excel** exportando exatamente essas colunas.
- **Botão Limpar** para descartar a importação.

Se o valor com desconto parcelado não permitir nenhuma parcela acima do mínimo, a coluna Parcelamento mostra "Somente à vista" (mesma regra já existente).

## Detalhes técnicos
- Novo componente `src/components/modelo-mensagem/LayoutVistaParcelamentoTab.tsx`, reaproveitando os helpers de parse de valor e montagem de parcelamento no padrão de `LayoutPlanilhaTab.tsx` (`GRADE_PARCELAS` e `PARCELA_MINIMA` de `@/lib/parseCobmaisPlanilha`).
- `src/pages/ModeloMensagem.tsx`: renomear o rótulo da aba `planilha` e registrar a nova aba/`TabsContent`.
- Nenhuma mudança de banco de dados ou backend.
