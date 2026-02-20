

## Remover logomarca do PDF da Notificacao Extrajudicial

### Resumo

Remover a imagem do logo "Souza & Ribeiro" do cabecalho do PDF gerado pela funcao `handleDownloadNotifPDF`, e ajustar a margem superior para aproveitar o espaco que era ocupado pelo logo.

### Alteracoes em `src/pages/DevedorDetalhe.tsx`

**1. Remover o bloco de insercao do logo (linhas 365-370)**

Dentro da funcao `addHeaderAndFooter`, remover o bloco `try/catch` que adiciona a imagem com `doc.addImage(logoSouzaRibeiro, ...)`.

**2. Reduzir margem superior (linha 360)**

Alterar `topMargin` de `45` para `20`, ja que nao ha mais logo no topo e o texto pode comecar mais acima.

**3. (Opcional) Remover import do logo**

Se o logo nao for mais usado em nenhum outro lugar do arquivo, remover o `import logoSouzaRibeiro`. Porem, o logo ainda e usado na funcao `handleDownloadNotifWord`, entao o import sera mantido.

