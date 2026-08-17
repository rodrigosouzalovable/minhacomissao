# Layout Planilha (Modelo Mensagem)

Nova aba na página **Modelo Mensagem**, visível apenas para logins admin, para transformar uma planilha simples de clientes em uma planilha com as opções de parcelamento prontas.

## Fluxo

1. **Importar planilha** (.xlsx/.xls): coluna A = nome, coluna B = telefone, coluna C = valor total devido. Cabeçalho é detectado e ignorado automaticamente; linhas sem telefone ou sem valor são descartadas.
2. **Campo de desconto do parcelamento (%)** acima da pré-visualização, ajustável a qualquer momento (padrão 30%).
3. **Botão Aplicar**: gera a pré-visualização em tabela com colunas Nome | Telefone | Parcelamento.
4. **Botão Baixar Excel**: exporta exatamente A = nome, B = telefone, C = texto do parcelamento.

## Regra do parcelamento

- Base = valor total × (1 − desconto%).
- Grade fixa: 2x, 4x, 8x, 12x, 16x, 20x, 24x.
- Uma opção só entra se a parcela ficar **≥ R$ 100,00**.
- Formato do texto (uma linha, como no exemplo): `2x de R$ 2.064,00, 4x de R$ 1.032,00, 8x de R$ 516,00, 12x de R$ 344,00, 16x de R$ 258,00, 20x de R$ 206,40 ou 24x de R$ 172,00`.
- Se nenhuma opção atender ao mínimo, a linha mostra apenas a opção de menor quantidade viável; se nenhuma for viável, mostra "Somente à vista".
- Linhas idênticas (mesmo nome + telefone + valor) são consolidadas para evitar duplicatas como as da planilha de exemplo.

## Detalhes técnicos

- Novo componente `src/components/modelo-mensagem/LayoutPlanilhaTab.tsx`.
- `src/pages/ModeloMensagem.tsx` passa a usar `Tabs` (shadcn): "Colar imagem" + "Layout Planilha", a segunda renderizada só quando `useUserRole().isAdmin`.
- Leitura/escrita do arquivo com a lib `xlsx` já presente no projeto; download client-side, sem backend.
- Helper de montagem do texto reutiliza a lógica de grade/mínimo já existente em `src/lib/parseCobmaisPlanilha.ts` (`GRADE_PARCELAS`, `PARCELA_MINIMA`), em formato de linha única.
