

## Plano: listar todos os clientes MONTREAL ao pesquisar, com quem já tem acordo no topo

### Diagnóstico

1. Hoje, na página `/clientes`, ao escolher credor MONTREAL e clicar **Pesquisar** sem digitar nome, o front lista os clientes — mas:
   - O fluxo atual pagina a tabela `devedores` em chamadas de 1000, e MONTREAL tem 1.064 linhas → traz tudo, ok, mas lento e sem ordenação por "tem acordo".
   - Não há nenhuma coluna/flag de "este CPF já tem acordo"; a ordenação é por `criado_em DESC`.

2. No banco confirmei: **MONTREAL tem 82 CPFs únicos e 1.064 contratos/parcelas ativos. Hoje nenhum desses CPFs tem acordo lançado** (`acordos` filtrado por CPF MONTREAL = 0). Ou seja, agora todos cairão na seção "sem acordo" — mas a infraestrutura precisa estar pronta para quando começarem a fechar acordos com Montreal.

### Mudanças

**1. Nova RPC `listar_devedores_por_credor(p_credor text)`** (servidor, indexada)

Retorna todos os devedores ativos do credor com uma flag pré-calculada `tem_acordo` — usando `EXISTS` em `acordos` com match por `cpf_normalize`. Como é cálculo no servidor, não trafegamos lixo e a ordenação fica eficiente:

```sql
SELECT d.id, d.nome, d.cpf, d.credor, d.contrato,
       d.valor_original, d.valor_atualizado, d.estagio, d.telefone,
       d.data_vencimento, d.descricao,
       EXISTS (
         SELECT 1 FROM public.acordos a
         WHERE public.cpf_normalize(a.cliente_cpf) = public.cpf_normalize(d.cpf)
           AND a.status = 'ativo'
       ) AS tem_acordo
FROM public.devedores d
WHERE d.ativo = true AND d.credor = p_credor
ORDER BY tem_acordo DESC, d.nome ASC
LIMIT 5000;
```

`SECURITY DEFINER`, `SET search_path = public`, `GRANT EXECUTE TO authenticated`. Sem custo extra de Cloud — é uma única query indexada.

**2. Ajuste no `src/pages/Clientes.tsx` → `handleSearch`**

Adicionar um terceiro caminho: **se a busca por nome estiver vazia, telefone vazio e um credor específico estiver selecionado**, chamar a nova RPC `listar_devedores_por_credor(credor)` em vez de paginar `devedores`. O retorno já vem ordenado.

**3. Ranking visível na tabela de resultados**

- Propagar a flag `tem_acordo` para `ClienteAgrupado` (no agrupamento por CPF/grupo: "tem acordo" se *qualquer* CPF do grupo tiver).
- Após o agrupamento por grupo empresarial (que já existe), aplicar uma ordenação final: `tem_acordo DESC, nome ASC` — garante que clientes com acordo aparecem **primeiro na fila**, mesmo após agrupamento.
- Adicionar um pequeno **badge "Com acordo"** (verde) na linha da tabela ao lado do nome, para visualização clara.

### O que NÃO muda

- Busca por nome / CPF / telefone continua igual (caminhos rápidos já corrigidos).
- Permissões de credor, agrupamento por grupo empresarial, exportação de telefones — intactos.
- Custo Cloud: zero adicional (RPC pontual).

### Arquivos a tocar

- **Migração SQL**: criar `listar_devedores_por_credor`.
- **`src/pages/Clientes.tsx`**: novo branch em `handleSearch`, propagar `tem_acordo` na agregação, ordenação final, badge "Com acordo".
- **`src/integrations/supabase/types.ts`**: regenerado automaticamente com a nova RPC.

### Resultado esperado

Selecionar MONTREAL + Pesquisar → lista os 82 clientes únicos (consolidados de 1.064 contratos), com aqueles que tiverem acordo aparecendo no topo e marcados visualmente. Hoje todos virão sem acordo; assim que o primeiro acordo MONTREAL for criado, ele sobe automaticamente para o topo da lista.

