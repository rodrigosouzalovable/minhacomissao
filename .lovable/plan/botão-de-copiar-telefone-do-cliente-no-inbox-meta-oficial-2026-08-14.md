# Botão de copiar telefone do cliente no Inbox Meta Oficial

Adicionar um botão de copiar ao lado do número do cliente dentro do cabeçalho de cada conversa na aba **Inbox Meta Oficial**.

## O que será feito

1. Importar o componente `CopyButton` em `src/pages/InboxMeta.tsx`.
2. Inserir o botão ao lado do telefone do cliente na linha do cabeçalho da conversa (abaixo do nome do contato), mantendo o texto "via {instância}".
3. O botão deve copiar o número completo do cliente (`contatoAtivo.telefone`) e usar o toast/ícone de confirmação já existente no `CopyButton`.
4. Ajustar o layout para manter o alinhamento e não quebrar o texto truncado (flex com gap).

## Detalhes técnicos

- Arquivo alterado: `src/pages/InboxMeta.tsx`.
- Componente reutilizado: `src/components/CopyButton.tsx`.
- Valor copiado: `contatoAtivo.telefone` (com dígitos limpos, pois o `CopyButton` remove não-numéricos por padrão).
- O botão aparece apenas quando houver um telefone válido no contato ativo.
