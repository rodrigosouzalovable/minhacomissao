

## Adicionar selecao e exclusao de contratos na pagina Clientes

### O que sera feito

Adicionar checkboxes ao lado de cada cliente na tabela de resultados, permitindo selecionar um ou mais registros e excluir todos de uma vez. A funcionalidade sera exclusiva para administradores.

### Funcionamento

1. Um novo botao "Excluir Contratos" aparecera ao lado do botao "Agrupar CNPJs" (somente para admins)
2. Ao clicar, a tabela entra em modo de selecao com checkboxes em cada linha (similar ao modo de agrupamento ja existente)
3. Um checkbox "Selecionar todos" aparecera no cabecalho da tabela
4. Um botao de confirmacao mostra a contagem de selecionados
5. Ao confirmar, um AlertDialog pede confirmacao antes de excluir
6. A exclusao remove os registros da tabela `devedores` (marcando `ativo = false` ou deletando, conforme a politica RLS existente)

### Secao tecnica

**Arquivo: `src/pages/Clientes.tsx`**

1. Adicionar estados para o modo de exclusao:
   - `deleteMode: boolean` - controla se o modo de selecao para exclusao esta ativo
   - `selectedForDeletion: Set<string>` - armazena os IDs dos devedores selecionados

2. Adicionar botao "Excluir Contratos" no cabecalho do card de resultados (ao lado de "Agrupar CNPJs"), visivel apenas para admins

3. Quando `deleteMode` estiver ativo:
   - Mostrar checkboxes em cada linha da tabela
   - Mostrar checkbox "Selecionar todos" no cabecalho
   - Mostrar botao "Excluir Selecionados (N)" e "Cancelar"
   - Ocultar os botoes de agrupamento para evitar conflito

4. Ao confirmar exclusao:
   - Mostrar AlertDialog com mensagem de confirmacao
   - Executar `supabase.from('devedores').delete().in('id', [...selectedIds])`
   - Atualizar a lista local removendo os registros excluidos
   - Exibir toast de sucesso

5. A selecao sera por **contrato individual** (ID do devedor), nao por CPF agrupado. Para clientes agrupados por CPF ou grupo empresarial, cada contrato individual podera ser selecionado expandindo ou selecionando o grupo inteiro (que seleciona todos os IDs dos devedores daquele CPF).

6. Importar `Trash2` do lucide-react e `AlertDialog` components

7. A politica RLS existente `Admins podem gerenciar devedores` (command ALL) ja permite DELETE para admins, entao nenhuma alteracao no banco e necessaria.

- Sem alteracoes no banco de dados
- Sem novas dependencias
