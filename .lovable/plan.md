

## Correções na aba Clientes

### Problemas identificados

1. **Campo Telefone não filtra nada**: O campo "Telefone" coleta o valor digitado mas nunca é usado na query de busca. Qualquer valor digitado ali é ignorado, retornando todos os resultados.

2. **Mensagem "Nenhum cliente encontrado"**: Já existe no código, mas precisa ser mais visível/destacada.

### Alterações

**Arquivo: `src/pages/Clientes.tsx`**

1. **Remover o campo Telefone** da interface de pesquisa, já que a tabela `devedores` não possui coluna de telefone. Manter o campo sem funcionalidade confunde o usuário. Alternativamente, se preferir manter o campo para uso futuro, desabilitá-lo visualmente.

2. **Melhorar a mensagem de "não encontrado"**: Quando a pesquisa retornar 0 resultados, exibir uma mensagem mais clara e destacada: "Cliente não encontrado", com um ícone ilustrativo.

3. **Validar que pelo menos um filtro foi preenchido** antes de permitir a pesquisa, evitando buscas vazias que retornam todos os registros.

### Detalhes técnicos

- Remover o state `telefone` e o campo de input correspondente
- Adicionar validação no `handleSearch`: se nenhum filtro foi preenchido (nome, cpf vazios e credor/estagio em "todos"), exibir um toast pedindo para preencher ao menos um filtro
- Melhorar o bloco de "nenhum resultado" com ícone `SearchX` e texto "Cliente não encontrado"

