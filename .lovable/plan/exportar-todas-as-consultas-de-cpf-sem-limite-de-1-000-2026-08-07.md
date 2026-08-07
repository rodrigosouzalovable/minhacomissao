# Exportar todas as consultas de CPF (sem limite de 1.000)

## O problema

O botão Excel do sininho (Inbox Meta Oficial) busca as consultas em uma única requisição. O backend devolve no máximo 1.000 registros por requisição, então o arquivo sai truncado — hoje existem 1.606 consultas registradas, mas só 1.000 são exportadas.

## O que vai mudar

- A exportação passará a buscar as consultas em páginas de 1.000 até acabar, juntando tudo em um único arquivo Excel.
- Enquanto baixa, o botão mostrará o progresso (ex.: "Baixando... 2.000"), para dar noção de andamento em bases grandes.
- O total no aviso final passará a refletir o número real de linhas exportadas.
- Sem alteração de permissão: admin exporta tudo; demais usuários continuam exportando apenas as consultas atribuídas a eles.

## Detalhes técnicos

Arquivo: `src/components/inbox/meta/NotificacoesCpfBell.tsx`, função `baixarExcel`.

- Substituir a consulta única por um laço com `.range(from, from + 999)` ordenado por `created_at desc`, acumulando os registros até uma página retornar menos de 1.000 linhas.
- Manter a resolução de nomes dos atendentes (`profiles`) após a coleta completa, usando os ids únicos de todas as páginas.
- Manter o mesmo mapeamento de colunas e o mesmo nome de arquivo.
