

## Atualizar vencimentos dos contratos (Daniel e Pollyane)

### Correspondencia encontrada

Cruzei a coluna E (Nro Nota) da planilha com os ultimos 6 digitos de cada contrato no sistema, e confirmei pelos valores. Todos os 12 registros batem perfeitamente.

### Atualizacoes a serem feitas

| Contrato   | Nota   | Desdob | Valor        | Vencimento   | ID no sistema                          |
|------------|--------|--------|--------------|--------------|----------------------------------------|
| 1001111034 | 111034 | 5      | R$ 5.284,80  | 09/01/2025   | ddf8bf54-8380-46af-a1fb-63630ab9bf12   |
| 1002111178 | 111178 | 3      | R$ 1.744,80  | 12/11/2024   | eb7c66c8-2f6c-4a5b-b184-6688c62833f4   |
| 1003112093 | 112093 | 5      | R$ 2.984,00  | 25/01/2025   | 2463fd0a-1be9-421b-9bab-c5cdc9d66f03   |
| 1004112089 | 112089 | 5      | R$ 2.984,00  | 25/01/2025   | 226eb863-fb3b-4198-88f1-db2fbd7e7a0f   |
| 1005112112 | 112112 | 5      | R$ 2.984,00  | 26/01/2025   | 01e76595-071f-4e3c-8991-f7b93678d104   |
| 1006112113 | 112113 | 5      | R$ 2.984,00  | 26/01/2025   | ba34bb62-45f4-47e1-bfa5-279c1090d4f9   |
| 1007110774 | 110774 | 5      | R$ 1.744,80  | 04/01/2025   | 5abd0e2c-e2de-4037-8dde-e1d4816bfbf7   |
| 1008112081 | 112081 | 5      | R$ 2.713,20  | 25/01/2025   | 654f7771-fa13-438d-afbb-8419320afd7e   |
| 1009112112 | 112112 | 4      | R$ 968,00    | 27/12/2024   | 9ea5bcc8-c50a-4ce5-99ad-66d304542d6c   |
| 1010110819 | 110819 | 5      | R$ 284,80    | 04/01/2025   | 5f1bb026-15d8-4c06-a34a-ca6462c6240b   |
| 1011112112 | 112112 | 2      | R$ 174,19    | 28/10/2024   | dbc41ac4-884f-4a7c-834d-df50e95119e3   |
| 1012111034 | 111034 | 3      | R$ 2.284,80  | 10/11/2024   | 4ed17dfa-eb0b-425d-93d1-bfc1326fa336   |

### Detalhes tecnicos

Executar 12 comandos UPDATE na tabela `devedores` para definir o campo `data_vencimento` de cada registro com a data correspondente da planilha. Nenhuma alteracao de codigo ou schema necessaria -- apenas atualizacao de dados.

