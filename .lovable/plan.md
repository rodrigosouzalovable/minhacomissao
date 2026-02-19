

## Preencher data de vencimento dos 31 titulos de D DECORACOES LTDA

### O que sera feito

Atualizar o campo `data_vencimento` de cada um dos 31 contratos cadastrados no banco, usando as datas extraidas da planilha "Divida_D_Decoracoes_09fev26_2.xlsx". O cruzamento foi feito pela combinacao de numero da nota (ultimos 6 digitos do campo `contrato`) e valor do titulo.

### Mapeamento completo (contrato -> data)

| Contrato    | Nota   | Valor       | Data Vencimento | ID no banco                          |
|-------------|--------|-------------|-----------------|--------------------------------------|
| 1001118452  | 118452 | 3.051,89    | 2025-04-27      | 5672ec85-abd4-4cd4-b304-c9c4c31f98fa |
| 1002119513  | 119513 | 3.833,78    | 2025-06-11      | ddf73378-30f4-4a99-b809-d1bdd81ca078 |
| 1003121428  | 121428 | 2.575,96    | 2025-06-18      | 4d10e248-1ce3-486b-85c1-a42a27481c4f |
| 1004121516  | 121516 | 3.978,14    | 2025-06-21      | 32cc2bba-4f65-4b26-8faf-c4e9d764f65d |
| 1005118452  | 118452 | 3.051,87    | 2025-07-04      | 260fa48f-b4cb-462f-9419-bc7927c0dec1 |
| 1006123438  | 123438 | 8.234,99    | 2025-07-04      | caa15b0b-a2f9-4f47-bbaa-ed8a6a5fa241 |
| 1007123473  | 123473 | 534,25      | 2025-07-04      | d8f2ed49-701c-46af-89ef-a9d6b21e3925 |
| 1008119513  | 119513 | 3.833,79    | 2025-07-30      | 987bb9ab-e455-4925-afbb-da7230f35ce1 |
| 1009121516  | 121516 | 3.978,14    | 2025-07-08      | df3738ad-01b0-4667-b3d7-641ac337279d |
| 1010123473  | 123473 | 534,25      | 2025-08-05      | e5213720-c44c-42b7-ae7d-2df6e790ffe1 |
| 1011123438  | 123438 | 8.234,99    | 2025-08-05      | 89c32bfe-a6d0-409b-a890-7b33809d1b02 |
| 1012124101  | 124101 | 129,50      | 2025-08-13      | d63cc5e3-8d7c-4570-a6a2-73e861834c6e |
| 1013123052  | 123052 | 997,37      | 2025-08-13      | 75c4ec62-6c99-42a3-8332-8b0aa3e69276 |
| 1014121516  | 121516 | 3.978,15    | 2025-08-20      | 5bff637e-2041-4778-ae60-6099b88e22b7 |
| 1015121428  | 121428 | 2.575,97    | 2025-08-20      | 2f33f116-e393-4a72-a2aa-641f098cae38 |
| 1016123473  | 123473 | 534,25      | 2025-08-26      | 9b6cb2b6-a841-4832-9ab0-9cd00a360aba |
| 1017124734  | 124734 | 397,50      | 2025-09-01      | 64793863-ded4-4651-858d-5db51f2d1397 |
| 1018123052  | 123052 | 997,37      | 2025-09-08      | f32385bc-6465-4fb9-af05-1f0aa44e614c |
| 1019124101  | 124101 | 129,50      | 2025-09-08      | b5de7764-a6ba-4ab3-844f-517d1a138b7e |
| 1020124734  | 124734 | 397,50      | 2025-09-22      | 310cc3a5-f9e2-4afa-965c-4f8e666680da |
| 1021122606  | 122606 | 9.357,58    | 2025-09-25      | 007928bc-a3dc-450e-b1a6-83acceff5dd8 |
| 1022123438  | 123438 | 8.234,97    | 2025-09-25      | 704e28a9-98f9-46b9-9b0f-02045bd0f059 |
| 1023123473  | 123473 | 534,25      | 2025-09-25      | e2b9998c-b3ab-4a39-936c-501a54b7a9f2 |
| 1024123052  | 123052 | 997,37      | 2025-10-01      | 9acb6f38-86d9-44f4-aa0f-d22e704519f1 |
| 1025124101  | 124101 | 129,50      | 2025-10-01      | 213f8aa4-3e1d-4705-9645-7b47349b484e |
| 1026124734  | 124734 | 397,50      | 2025-10-31      | c113f4fc-d451-47f3-8627-564ac432159f |
| 1027123438  | 123438 | 2.234,97    | 2025-09-29      | c634becd-4672-40da-b43f-c2ce36773da8 |
| 1028122606  | 122606 | 9.357,60    | 2025-07-04      | b8e8fe60-7404-4be2-b9a8-2795f7dfb95d |
| 1029122606  | 122606 | 9.357,60    | 2025-08-26      | 039baf39-5f1e-4340-b17d-9bb1ea4d93d8 |
| 1030123438  | 123438 | 8.234,99    | 2025-08-26      | 378c24e0-eea8-4408-aa07-292e7e836fc7 |
| 1031122606  | 122606 | 2.933,56    | 2025-08-05      | a1320c2c-66f6-4c5a-925c-f860c836a9e4 |

### Detalhes tecnicos

Executar 31 comandos UPDATE na tabela `devedores` para preencher o campo `data_vencimento` de cada registro, usando o ID como chave primaria. Exemplo:

```text
UPDATE devedores SET data_vencimento = '2025-04-27' WHERE id = '5672ec85-abd4-4cd4-b304-c9c4c31f98fa';
UPDATE devedores SET data_vencimento = '2025-06-11' WHERE id = 'ddf73378-30f4-4a99-b809-d1bdd81ca078';
-- ... (demais 29 registros)
```

Nenhuma alteracao de codigo eh necessaria -- apenas atualizacao de dados no banco.

### Resultado esperado

- Todos os 31 cards de contratos na ficha do cliente exibirao a data de vencimento
- A calculadora de debito podera preencher automaticamente a "Data Base" ao selecionar um contrato
- O badge de "dias em atraso" aparecera corretamente em cada card

