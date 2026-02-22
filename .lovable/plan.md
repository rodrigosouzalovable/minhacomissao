
# Identificar Acordos Existentes no Portal de Negociacao

## Problema

Quando um devedor consulta o CPF no portal publico de negociacao, ele nao sabe se ja existe um acordo ativo lancado por um funcionario na area restrita. Isso pode gerar confusao: o cliente tenta negociar pelo portal enquanto ja tem um acordo em andamento internamente.

## Solucao

Ao consultar o CPF no portal, verificar na tabela `acordos` se ja existe um acordo ativo para aquele CPF. Se existir, exibir um aviso claro informando que ja ha uma negociacao em andamento e orientar o cliente a entrar em contato pelo WhatsApp para acompanhamento.

## Mudancas

### 1. Nova funcao no banco de dados (migration)

Criar uma funcao `consultar_acordo_ativo_por_cpf(p_cpf text)` que retorna informacoes basicas do acordo ativo (se existir):
- Status do acordo
- Nome do funcionario responsavel
- Data de criacao do acordo

Essa funcao usa `SECURITY DEFINER` para que o portal (sem autenticacao) consiga consultar, sem expor dados sensíveis -- retorna apenas o status e o primeiro nome do responsavel.

### 2. Alteracao em `ConsultaResultado.tsx`

- Ao carregar a pagina, alem de buscar debitos, chamar a nova funcao para verificar se ha acordo ativo
- Se houver acordo ativo, exibir um **banner informativo** no topo da pagina com:
  - Icone de alerta/check
  - Mensagem: "Voce ja possui uma negociacao em andamento!"
  - Informacao do status (ativo/concluido)
  - Botao para entrar em contato pelo WhatsApp com mensagem pre-preenchida
- Se o acordo estiver com status "ativo", **bloquear** o botao "NEGOCIAR AGORA COM DESCONTO" para evitar duplicidade
- Se o acordo estiver "quebrado", permitir nova negociacao normalmente (ja e o comportamento esperado pelo trigger `acordos_block_duplicate_cpf`)

### 3. Formato do banner

O banner sera exibido entre o cabecalho do cliente e os cards de debito, com estilo visual consistente (fundo escuro com borda verde/amarela):

```
----------------------------------------------
  Voce ja possui uma negociacao em andamento!
  
  Seu acordo esta sendo acompanhado por nossa 
  equipe. Entre em contato para mais detalhes.
  
  [Falar no WhatsApp]
----------------------------------------------
```

## Detalhes Tecnicos

### Funcao SQL

```sql
CREATE OR REPLACE FUNCTION public.consultar_acordo_ativo_por_cpf(p_cpf text)
RETURNS TABLE(
  acordo_status text,
  acordo_criado_em timestamptz,
  funcionario_nome text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.status,
    a.criado_em,
    p.nome
  FROM acordos a
  JOIN profiles p ON p.id = a.user_id
  WHERE cpf_normalize(a.cliente_cpf) = cpf_normalize(p_cpf)
    AND a.status IN ('ativo', 'concluido')
  ORDER BY a.criado_em DESC
  LIMIT 1;
END;
$$;
```

### Logica no frontend

- Novo estado: `acordoExistente` com `{ status, criadoEm, funcionarioNome } | null`
- Chamada RPC `consultar_acordo_ativo_por_cpf` no mesmo `useEffect` que busca debitos
- Condicional: se `acordoExistente` e status "ativo", mostra banner e desabilita negociacao
- Se status "quebrado" ou sem acordo, comportamento normal
