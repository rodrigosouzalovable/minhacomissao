# Excel da aba UAZAPI: só números conectados, no formato 62999999999

## O que muda

1. O botão "Exportar números (Excel)" passa a incluir **apenas instâncias com status conectado**. Instâncias desconectadas (ou sem status verificado) ficam fora do arquivo.
2. Antes de gerar o arquivo, o sistema verifica a conexão das instâncias caso o status ainda não tenha sido carregado, para não exportar uma lista incompleta.
3. Os números são gravados **sem o DDI 55**, apenas dígitos: `62999999999`.
4. Se nenhuma instância conectada tiver número cadastrado, aparece um aviso explicando isso em vez de baixar um arquivo vazio.
5. O aviso final informa quantos números conectados foram exportados.

## Detalhes técnicos

- `src/pages/Acionamento.tsx` → `handleExportarNumeros`:
  - filtra `instances` por `connectionStatus[i.id] === 'connected'` (mesma fonte usada no badge "X/N conectados");
  - se nenhum status estiver preenchido, chama `checkInstanceConnections()` e aguarda antes de filtrar;
  - normaliza cada `telefone`: remove não dígitos e retira o prefixo `55` quando o total ficar com 12–13 dígitos, resultando em DDD + número;
  - dedupe simples para evitar linhas repetidas; escreve como texto em coluna única via `aoa_to_sheet` (sem cabeçalho), como hoje.
- Nenhuma mudança de banco, edge function ou regra de envio.
