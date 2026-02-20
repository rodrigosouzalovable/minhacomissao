

## Mostrar nome do funcionario na mensagem de CPF duplicado

### O que sera feito

Quando um funcionario tenta cadastrar um acordo com um CPF que ja possui acordo ativo, a mensagem de erro passara a informar o nome do funcionario que ja tem o acordo lancado. Exemplo: "Este CPF ja possui acordo lancado por Joao Silva."

### Alteracoes

**1. Migracao SQL - Atualizar a funcao `acordos_block_duplicate_cpf`**

Modificar o trigger para buscar o nome do funcionario (da tabela `profiles`) que possui o acordo existente com aquele CPF, e incluir na mensagem de erro:

```sql
-- Buscar o nome do funcionario do acordo existente
SELECT p.nome INTO v_nome_funcionario
FROM acordos a
JOIN profiles p ON p.id = a.user_id
WHERE cpf_normalize(a.cliente_cpf) = cpf_normalize(NEW.cliente_cpf)
AND a.id IS DISTINCT FROM NEW.id
ORDER BY a.criado_em DESC
LIMIT 1;

RAISE EXCEPTION 'Este CPF já possui acordo lançado por %.', v_nome_funcionario;
```

**2. `src/pages/NovoAcordo.tsx` - Exibir a mensagem do backend**

No bloco `catch` do `handleSubmit`, verificar se o erro vem do trigger (mensagem contendo "Este CPF já possui acordo") e exibir a mensagem exata retornada pelo banco em vez da mensagem generica "Erro ao criar acordo / Tente novamente mais tarde."

