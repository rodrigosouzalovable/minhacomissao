

## Atualizar vencimentos dos contratos (RM Barreto)

### Correspondencia encontrada

Cruzei a coluna Nro Nota da planilha com os ultimos 6 digitos de cada contrato no sistema, e confirmei pelos valores. Todos os 9 registros batem perfeitamente.

### Atualizacoes a serem feitas

| Contrato   | Nota   | Valor         | Vencimento   | ID no sistema                          |
|------------|--------|---------------|--------------|----------------------------------------|
| 1001101484 | 101484 | R$ 17.754,00  | 29/02/2024   | ef9c760f-27af-49d8-92b8-a0917ba1d3e0   |
| 1002101408 | 101408 | R$ 13.325,00  | 29/02/2024   | c593a310-34d5-41ea-8b97-61381217cbed   |
| 1003101407 | 101407 | R$ 13.325,00  | 29/02/2024   | 444c3a4c-e0dc-4611-9fde-2a4c33ebe068   |
| 1004101410 | 101410 | R$ 13.325,00  | 29/02/2024   | 33dddf19-98ba-4632-b712-bee745f5e0ae   |
| 1005101409 | 101409 | R$ 13.325,00  | 29/02/2024   | 458319d7-f804-4636-98e2-f8cddaad2e01   |
| 1006104335 | 104335 | R$ 13.055,00  | 27/04/2024   | 5b46f92e-8dab-431f-84f7-b7b96a24848a   |
| 1007104336 | 104336 | R$ 11.779,00  | 27/04/2024   | 26cde266-9b51-4310-b990-550a79a4d4a6   |
| 1008104337 | 104337 | R$ 11.176,00  | 27/04/2024   | fefd1373-f19b-4384-8884-5799c1cec7fe   |
| 1009105423 | 105423 | R$ 10.245,00  | 22/05/2024   | 4dc349f3-5b6a-4f30-be11-38b482bcb8bd   |

### Detalhes tecnicos

Executar 9 comandos UPDATE na tabela `devedores` para definir o campo `data_vencimento` de cada registro com a data correspondente da planilha. Nenhuma alteracao de codigo ou schema necessaria -- apenas atualizacao de dados.
