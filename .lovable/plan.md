# Botão "Baixar planilha pronta" na aba Proposta {{2}} SFTP

## Problema
O cálculo funcionou (978 de 1000 clientes com proposta), mas o arquivo é baixado automaticamente só no fim do cálculo. Nesse momento o navegador já não considera mais o seu clique e bloqueia o download sem avisar (isso acontece principalmente dentro da prévia).

## O que muda
- Depois do cálculo, a planilha pronta fica guardada na tela.
- Aparece um botão verde **"Baixar planilha pronta"** dentro do resumo (ao lado de "978 de 1000 clientes com proposta").
- O clique nesse botão baixa na hora o arquivo `NOME_PRONTO.xlsx`, com as abas "Pronto para envio" e "Sem dívida no SFTP".
- Você pode baixar quantas vezes quiser sem calcular de novo. Ao enviar outra planilha, o botão passa a baixar a nova.
- O texto do resumo muda de "Planilha baixada" para "Planilha pronta".

## Detalhes técnicos
- `PropostaSftpTab.tsx`: guardar o workbook gerado (e o nome do arquivo) em estado em vez de chamar `XLSX.writeFile` depois dos `await`; o botão chama `XLSX.writeFile` de forma síncrona no próprio clique.
- Cálculo, regras e o texto da Opção A não mudam.
- Verificação: Playwright na tela com a planilha TESTE_ODRES, confirmando que o clique gera o download e que o arquivo tem a coluna {{2}} preenchida.
