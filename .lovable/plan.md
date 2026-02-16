

## Plano: Criar aba "Clientes" com dashboard de pesquisa

### O que sera feito

Adicionar uma nova aba "Clientes" no menu lateral, posicionada entre "Retornos" e "Minhas Comissoes", com uma pagina de pesquisa de clientes importados (tabela `devedores`). O layout sera inspirado na imagem de referencia.

### Banco de Dados

A tabela `devedores` ja existe e contem os campos necessarios. Porem, sera preciso adicionar duas colunas:

- `credor` (text) - para armazenar o credor (MUNDO DA MODA, UME | NOVO MUNDO, MONTREAL). Atualmente o credor e salvo no campo `descricao`.
- `estagio` (text, default 'novo') - para armazenar o estagio do cliente (Novo, Andamento, Finalizado).

Tambem sera necessario adicionar uma **RLS policy de SELECT** para usuarios autenticados poderem consultar os devedores.

Alem disso, corrigir a importacao para salvar o credor no campo `credor` em vez de `descricao`.

### Alteracoes

**1. Migracao SQL**
- Adicionar coluna `credor` (text, nullable) na tabela `devedores`
- Adicionar coluna `estagio` (text, default 'novo') na tabela `devedores`
- Copiar dados existentes de `descricao` para `credor` onde aplicavel
- Adicionar RLS policy de SELECT para usuarios autenticados

**2. Novo arquivo: `src/pages/Clientes.tsx`**
- Pagina com filtros de pesquisa:
  - Nome (input texto)
  - CPF/CNPJ (input texto)
  - Telefone (input texto) - obs: tabela nao tem telefone, campo ficara para busca futura
  - Credor (dropdown: TODOS, MUNDO DA MODA, UME | NOVO MUNDO, MONTREAL)
  - Atraso De / Ate (inputs numericos)
  - Estagios (dropdown multi ou checkboxes: Novo, Andamento, Finalizado)
- Botao "Pesquisar" que consulta a tabela `devedores` com os filtros aplicados
- Botao "Limpar" para resetar filtros
- Tabela de resultados com colunas: Nome, CPF/CNPJ, Credor, Contrato, Atraso, Estagio
- Paginacao nos resultados

**3. `src/App.tsx`**
- Importar a pagina `Clientes`
- Adicionar rota `/clientes` como ProtectedRoute

**4. `src/components/layout/AppLayout.tsx`**
- Adicionar item de navegacao "Clientes" com icone `Search` entre "Retornos" e "Minhas Comissoes" (path: `/clientes`)

**5. `src/pages/ImportarDevedores.tsx`**
- Alterar mapeamento da importacao para salvar o credor no novo campo `credor` em vez de `descricao`

**6. `src/hooks/useUserPermissions.tsx`**
- Adicionar `/clientes` ao array default de `abas_permitidas` (no banco e no hook, se necessario)

### Detalhes tecnicos

```text
Filtros da pesquisa:
+------------------+------------------+------------------+------------------+
| Nome (input)     | CPF/CNPJ (input) | Telefone (input) | Credor (select)  |
+------------------+------------------+------------------+------------------+
| Atraso De (input)| Atraso Ate (input)| Estagios (select)| [Pesquisar]     |
+------------------+------------------+------------------+------------------+

Tabela de resultados:
| Nome | CPF/CNPJ | Credor | Contrato | Atraso | Estagio |
```

A consulta ao banco usara filtros com `ilike` para nome e CPF, e filtros exatos para credor e estagio. O campo atraso sera filtrado como texto ou convertido para numerico conforme armazenado.

