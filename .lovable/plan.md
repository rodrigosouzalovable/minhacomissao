## Problema

Na tela **Importar pagos**, todas as linhas aparecem como "Sem acordo" mesmo quando o acordo existe no sistema.

## Causa raiz (verificada no banco)

- A planilha traz CPF como dígitos (`04985806366`).
- Na tabela `acordos`, os CPFs estão salvos **formatados** (ex.: `049.858.063-66` — confirmado via query no acordo do Jardel Sena).
- O `ImportarPagosDialog` faz `.in('cliente_cpf', [digitos...])`, que nunca casa com as strings formatadas → todos caem em `sem_acordo`.

## Correção

Alterar apenas `src/components/ImportarPagosDialog.tsx`, função `avaliarLinhas`:

1. Gerar, para cada CPF único, duas variantes: só-dígitos e formatada `XXX.XXX.XXX-XX`.
2. Enviar as duas variantes no filtro `.in('cliente_cpf', lote)`.
3. A normalização já existente ao popular o `Map` (linha 80) mantém a chave em dígitos, então o match posterior continua idêntico.

Nada mais muda: parser, matching de parcela, tolerância de valor, update final e UI permanecem como estão. Depois disso, linhas com acordo existente passam a mostrar a tag verde "Pronto para marcar" (ou "Valor divergente", conforme o caso).
