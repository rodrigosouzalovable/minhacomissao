# Layout à vista + parcelamento: CPF, primeiro nome e planilha separada

Ajustes na aba **Modelo Mensagem → Layout à vista + parcelamento**.

## 1. Coluna CPF na pré-visualização
- O seletor de papel de cada coluna passa a ter a opção **CPF**, ao lado de Nome, Telefone e Valor total devido.
- Detecção automática: colunas com cabeçalho tipo "CPF"/"CNPJ"/"Documento" ou com conteúdo de 11/14 dígitos já vêm marcadas.
- CPF é opcional: se não for marcado, a coluna sai vazia na planilha.
- Na exportação o CPF é normalizado (só dígitos, com zeros à esquerda recompostos para 11 ou 14 dígitos, já que o Excel costuma removê-los).

## 2. Nome apenas com o primeiro nome
- Na pré-visualização e no Excel, o nome exibido é somente o **primeiro nome**, com inicial maiúscula e o resto minúsculo (ex.: "MARIA DAS DORES" → "Maria").
- Preposições isoladas ("de", "da", "dos") não são consideradas primeiro nome — nesse caso usa a primeira palavra real.

## 3. Credor na pré-visualização
- O seletor de **Credor** (Novo Mundo até 24x / UME até 18x) fica também logo acima da tabela de pré-visualização, junto dos botões de download, para poder trocar o credor e reaplicar sem rolar a página.

## 4. Downloads separados
Três botões:
- **Baixar Excel (à vista + parcelado)** — apenas os clientes que têm opções de parcelamento válidas.
- **Baixar "Somente à vista"** — apenas os clientes cuja parcela ficaria abaixo de R$ 100,00 (hoje marcados como "Somente à vista"), em arquivo próprio.
- **Limpar**.

Colunas de ambas as planilhas: Telefone | CPF | Nome | Valor original | À vista | Parcelamento (na planilha "Somente à vista" a última coluna é omitida).

Cada botão mostra a contagem de linhas (ex.: "Somente à vista (37)") e fica desabilitado quando não há linhas naquele grupo.

## Detalhes técnicos
- `src/components/modelo-mensagem/MapearColunasPlanilha.tsx`: adicionar `'cpf'` a `PapelColuna`, label, regex de detecção (`RX_CPF`) e heurística por conteúdo; `extrairLinhas` retorna também `cpf`.
- `src/components/modelo-mensagem/LayoutVistaParcelamentoTab.tsx`: campo `cpf` e `primeiroNome` em `LinhaPreview`, split do preview em `comParcelamento` / `somenteAVista`, duas funções de download e o seletor de credor duplicado acima da tabela.
- Helpers de primeiro nome e normalização de documento ficam em `src/lib/gradeCredor.ts` para reuso pela aba Layout Parcelamento se necessário.
- A aba **Layout Parcelamento** continua funcionando igual (a nova coluna CPF é opcional e ignorada lá).
- Sem mudanças de banco de dados ou backend.
