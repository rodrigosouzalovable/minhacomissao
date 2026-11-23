# Importação da base Novo Mundo com escolha de colunas

## Por que deu erro
A planilha enviada (30.000 linhas) tem só 2 colunas: **telefone sem o 55** e **nome**. Hoje o sistema exige 3 colunas fixas (telefone, saudação `{{1}}` e nome `{{2}}`) e o telefone com 55, por isso recusou todas as linhas ("Nenhum contato válido no arquivo").

## O que muda na aba Aquecimento Meta
1. **Instruções abaixo do botão "Importar Excel"**, com um exemplo:

```text
Coluna A: Telefone (com ou sem 55)   ex.: 61995770974
Coluna B: Nome do cliente            ex.: Abadia Alves Da Silva
Coluna C (opcional): Saudação        ex.: tudo bem?
Cabeçalho é opcional. Até 30.000 linhas por arquivo.
```

2. **Janela de escolha de colunas** (igual à do Envio Meta): ao escolher o arquivo, aparece uma prévia das primeiras linhas e, em cada coluna, uma lista para marcar **Telefone**, **Nome** e **Saudação** (ou **Ignorar**). O sistema já sugere sozinho, por exemplo: coluna com números vira Telefone e coluna com texto vira Nome.
3. **Saudação automática**: se não houver coluna de saudação, o sistema preenche alternando "tudo bem?" e "como vai, tudo bem?", como nos lotes anteriores.
4. **Telefone sem 55**: o 55 é acrescentado automaticamente. Números inválidos são ignorados e aparecem no resumo.
5. Depois de confirmar as colunas, continua o fluxo atual: resumo (novos, repetidos, bloqueados, já usados), confirmação de autorização e importação.

A sua planilha atual vai entrar sem precisar ser alterada.

## Detalhes técnicos
- Novo componente `NovoMundoMapearColunasDialog` (leve, específico: papéis telefone/nome/saudação/ignorar, detecção por cabeçalho e por amostra), usado por `NovoMundoContatosCard`.
- `conferirContatosNovoMundo` passa a receber os índices das colunas e uma saudação padrão alternada; normaliza telefone com 10/11 dígitos adicionando 55 antes de `telefoneNovoMundo`.
- A função de importação no banco não muda (já recebe telefone/var1/var2 e aceita 30.000 linhas).
- Atualizar o teste das regras Novo Mundo para: 2 colunas sem 55 aceitas e saudação preenchida.
