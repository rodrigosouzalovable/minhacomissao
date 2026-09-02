# Prévia do template com dados reais da planilha

Na tela "Mapear colunas da planilha" (aba Envio Meta), o bloco de template no topo hoje mostra apenas `{{1}}`, `{{2}}`, `{{3}}` destacados. A mudança faz esse texto se atualizar em tempo real conforme você escolhe o papel de cada coluna, usando os valores da primeira linha de dados da planilha.

## Comportamento

- Ao marcar uma coluna como `{{1}}`, o `{{1}}` no texto do topo é substituído pelo valor da primeira linha dessa coluna (ex.: "Sandra"), destacado em cor para indicar que é um valor de exemplo.
- O mesmo vale para `{{2}}`, `{{3}}` e demais variáveis; cada seleção atualiza imediatamente a prévia.
- Variáveis ainda não mapeadas continuam aparecendo como `{{n}}` no formato atual (placeholder), deixando claro o que falta.
- O valor exibido respeita o formato escolhido na coluna (R$ 4.607,58 / 4.607,58 / Texto original), igual à prévia da tabela.
- Se a coluna estiver vazia na primeira linha, cai de volta para o placeholder `{{n}}`.
- Legenda curta abaixo do texto: "Exemplo com os dados da primeira linha da planilha".

## Detalhes técnicos

- Arquivo único: `src/components/meta/MapearColunasImportDialog.tsx`.
- Substituir a renderização atual via `dangerouslySetInnerHTML` por uma renderização em React (array de nós), evitando HTML injetado a partir de dados da planilha.
- Fonte do exemplo: primeira linha de dados (`firstIsHeader ? rows[1] : rows[0]`), com o valor formatado por `valorCelula(col, valor)` — mesma função já usada na tabela, então mudanças no seletor de formato refletem na prévia.
- Mapear `tplvar:<key>` → índice de coluna com a mesma lógica de `tplByKey` já existente em `confirmar`, extraída para um `useMemo` reutilizado pela prévia.
- Sem alterações em Edge Functions, banco ou no fluxo de importação/envio.
