

## Reativar Cliente PAIVA E LEAO COMERCIO DE COLCHOES LTDA

### Situação
- CNPJ: 34.637.487/0001-30
- Credor: MONTREAL
- 31 contratos, todos com `ativo = false`
- Foram desativados quando um acordo do cliente (`acordos_devedor`) foi criado

### O que será feito

1. **Executar UPDATE no banco** para reativar todos os 31 registros:
   ```sql
   UPDATE devedores SET ativo = true WHERE cpf = '34637487000130';
   ```

Isso é uma operação simples de banco de dados, sem alteração de código.

