

## Mostrar nome do funcionario na validacao de CPF duplicado

### Problema

Quando um funcionario digita um CPF que ja possui acordo ativo, a mensagem exibida e generica: "Este CPF ja possui acordo ativo. Contate o administrador." O usuario precisa saber quem ja lancou o acordo naquele CPF.

### Solucao

Criar uma nova funcao no banco de dados que retorna o nome do funcionario dono do acordo existente, e usar essa informacao na mensagem.

### Alteracoes

**1. Migracao SQL - Nova funcao `cpf_acordo_funcionario_nome`**

Criar uma funcao que recebe um CPF e retorna o nome do funcionario que possui o acordo mais recente para aquele CPF:

```sql
CREATE OR REPLACE FUNCTION public.cpf_acordo_funcionario_nome(p_cpf text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_nome text;
BEGIN
  SELECT p.nome INTO v_nome
  FROM acordos a
  JOIN profiles p ON p.id = a.user_id
  WHERE cpf_normalize(a.cliente_cpf) = cpf_normalize(p_cpf)
  ORDER BY a.criado_em DESC
  LIMIT 1;

  RETURN v_nome;
END;
$$;
```

**2. `src/pages/NovoAcordo.tsx` - Buscar e exibir o nome**

No bloco onde o CPF duplicado e detectado (linha 571-574), apos confirmar que nao e quebra, chamar a nova funcao RPC para obter o nome do funcionario e montar a mensagem personalizada:

```typescript
// Apos confirmar que nao e quebra:
const { data: nomeFuncionario } = await supabase.rpc('cpf_acordo_funcionario_nome', { p_cpf: formatted });
const nome = nomeFuncionario || 'outro funcionário';
setCpfDuplicateError(`Este CPF já possui acordo ativo lançado por ${nome}. Contate o administrador.`);
```

A mensagem passara a exibir, por exemplo: "Este CPF ja possui acordo ativo lancado por Joao Silva. Contate o administrador."
