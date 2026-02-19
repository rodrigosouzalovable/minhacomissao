

## Atualizar vencimentos dos contratos a partir da planilha

### Correspondencia encontrada

Analisei a coluna E (Nro Nota) da planilha e cruzei com os ultimos 6 digitos de cada contrato no sistema. Todos os 28 registros foram mapeados com sucesso.

### Logica de correspondencia

Para cada Nro Nota, ordenei os desdobramentos (parcelas) em ordem crescente e associei ao contrato correspondente no sistema (tambem em ordem crescente de prefixo). Os valores batem em todos os casos.

### Atualizacoes a serem feitas

Sao 28 registros na tabela `devedores` que terao o campo `data_vencimento` preenchido:

| Contrato   | Nota   | Desdob | Valor      | Vencimento |
|------------|--------|--------|------------|------------|
| 1001109860 | 109860 | 2      | R$ 995,80  | 17/09/2024 |
| 1002109860 | 109860 | 5      | R$ 995,80  | 17/09/2024 |
| 1003111746 | 111746 | 1      | R$ 11.546  | 22/09/2024 |
| 1004112087 | 112087 | 1      | R$ 11.546  | 27/09/2024 |
| 1005106880 | 106880 | 5      | R$ 5.591,50| 18/10/2024 |
| 1006111746 | 111746 | 2      | R$ 11.546  | 22/10/2024 |
| 1007112087 | 112087 | 2      | R$ 11.546  | 27/10/2024 |
| 1008107309 | 107309 | 5      | R$ 1.093,98| 08/11/2024 |
| 1009111746 | 111746 | 3      | R$ 11.546  | 21/11/2024 |
| 1010112087 | 112087 | 3      | R$ 11.546  | 26/11/2024 |
| 1011112115 | 112115 | 3      | R$ 1.514,40| 27/11/2024 |
| 1012112118 | 112118 | 3      | R$ 1.514,40| 27/11/2024 |
| 1013111244 | 111244 | 3      | R$ 6.965,32| 29/11/2024 |
| 1014111244 | 111244 | 4      | R$ 6.965,32| 29/11/2024 |
| 1015111221 | 111221 | 4      | R$ 504,00  | 13/12/2024 |
| 1016111322 | 111322 | 4      | R$ 1.573,13| 14/12/2024 |
| 1017111322 | 111322 | 5      | R$ 1.573,13| 14/12/2024 |
| 1018111746 | 111746 | 4      | R$ 11.546  | 21/12/2024 |
| 1019112087 | 112087 | 4      | R$ 11.546  | 26/12/2024 |
| 1020112115 | 112115 | 4      | R$ 1.514,40| 27/12/2024 |
| 1021112118 | 112118 | 4      | R$ 1.514,40| 27/12/2024 |
| 1022111222 | 111222 | 5      | R$ 667,00  | 12/01/2025 |
| 1023111244 | 111244 | 5      | R$ 6.965,30| 12/01/2025 |
| 1024111221 | 111221 | 5      | R$ 504,00  | 12/01/2025 |
| 1025111746 | 111746 | 5      | R$ 11.546  | 20/01/2025 |
| 1026112087 | 112087 | 5      | R$ 11.546  | 25/01/2025 |
| 1027112115 | 112115 | 5      | R$ 1.514,40| 26/01/2025 |
| 1028112118 | 112118 | 5      | R$ 1.514,40| 26/01/2025 |

### Detalhes tecnicos

Executar 28 comandos UPDATE na tabela `devedores` usando o ID de cada registro para definir o campo `data_vencimento` com a data correspondente da planilha. Nenhuma alteracao de codigo ou schema necessaria -- apenas atualizacao de dados.

