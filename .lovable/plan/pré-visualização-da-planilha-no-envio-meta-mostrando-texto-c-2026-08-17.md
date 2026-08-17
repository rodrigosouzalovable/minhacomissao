# Pré-visualização da planilha no Envio Meta mostrando texto cortado

## O que está acontecendo

A planilha enviada está correta: a coluna C traz o parcelamento completo (`2x de R$ 1.479,45, 4x de R$ 739,72, ... ou 24x de R$ 123,29`).

O corte acontece só na exibição. No diálogo de mapeamento de colunas, cada célula da tabela de conferência está limitada a 220px com corte de texto em uma única linha, então textos longos aparecem truncados (como no print). O valor enviado na mensagem não é afetado — apenas a visualização.

## Alteração proposta

Ajustar apenas a apresentação da tabela de pré-visualização no diálogo de mapeamento:

- Permitir que a célula da coluna de valores longos quebre em várias linhas em vez de cortar, com largura máxima maior.
- Manter alinhamento no topo e fonte monoespaçada pequena para continuar legível.
- Manter o texto completo também no tooltip (hover) e na linha de exemplo abaixo do nome da coluna, hoje igualmente truncada.
- Manter a área com scroll vertical para não esticar o diálogo.

## Detalhes técnicos

Arquivo: `src/components/meta/MapearColunasImportDialog.tsx`

- Linha ~392: exemplo do primeiro registro — trocar `truncate` por quebra de linha com limite de linhas.
- Linha ~404: células da tabela — remover `truncate max-w-[220px]`, usar `whitespace-pre-wrap break-words align-top` com largura máxima maior.

Nenhuma mudança em lógica de importação, mapeamento ou envio.
