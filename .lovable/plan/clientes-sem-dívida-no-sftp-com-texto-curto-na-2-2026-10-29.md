# Clientes "sem dívida no SFTP" com texto curto na {{2}}

## O que muda
Na aba **Proposta {{2}} SFTP** do Modelo Mensagem, clientes sem dívida no SFTP deixam de ficar com a {{2}} vazia e passam a receber um texto curto, sem valores:
- **ODRES CRED:** `*Odres Cred referente ao seu telefone. Pagando a 1ª no PIX seu aparelho desbloqueia na hora!*`
- **UME:** `*UME com condições especiais de final de ano. Pague a 1ª no PIX e volte a comprar a prazo!*`

O credor de cada linha vem da coluna CREDOR (quando existe) ou do botão selecionado (UME / ODRES CRED), como já funciona hoje.

A planilha exportada passa a ter **uma aba só** ("Pronto para envio") com todos os clientes, na ordem original. O resumo na tela continua mostrando quantos receberam proposta com valores e quantos receberam o texto curto.

## Detalhes técnicos
- `src/lib/propostaSftp.ts`: nova constante `TEXTOS_SEM_DIVIDA` por credor e função `textoSemDivida(credor)` (retorna o texto já com asteriscos).
- `PropostaSftpTab.tsx`: resolver o credor antes da checagem de dívida; quando `!info || soma <= 0`, preencher `linha[iVar] = textoSemDivida(cred)` (e normalizar CPF). Remover a aba "Sem dívida no SFTP"; exportar todas as linhas numa única aba. Ajustar o texto do resumo.
- Teste em `propostaSftp.test.ts` com o texto exato de cada credor.
