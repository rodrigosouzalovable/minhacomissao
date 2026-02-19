

## Simplificar cabecalho e remover card de Telefones

### O que sera feito

1. **Remover o card "Telefones"** (linhas 288-305) -- a tabela inteira de telefones com colunas Numero, Tipo, WhatsApp, etc. sera removida da pagina
2. **Limpar o cabecalho** -- remover os campos "Contrato" e "Descricao" do grid, mantendo apenas CPF/CNPJ, Telefone e Credor
3. **Adicionar botao de editar/adicionar contato** no cabecalho, ao lado das informacoes de telefone, que abrira um dialog para gerenciar telefones

### Detalhes tecnicos

**Arquivo: `src/pages/DevedorDetalhe.tsx`**

**Cabecalho (linhas 255-284):**
- Remover o bloco condicional de `devedor.contrato` (linhas 272-277)
- Remover o bloco condicional de `devedor.descricao` (linhas 278-283)
- Manter apenas: CPF/CNPJ, Telefone e Credor
- Adicionar um botao com icone de editar (Pencil ou UserPlus) ao lado do campo Telefone, que abrira o TelefoneDialog existente para adicionar/editar contatos

**Card Telefones (linhas 288-305):**
- Remover o card inteiro com o componente TelefoneTab
- O TelefoneTab continuara importado mas sera acessado via dialog ao clicar no botao de editar contato no cabecalho

**Novo dialog de contatos:**
- Ao clicar no botao, abre um Dialog contendo o TelefoneTab (reutilizando o componente existente)
- Isso mantem toda a funcionalidade de gerenciamento de telefones sem ocupar espaco na pagina principal

### Resultado esperado

- Cabecalho limpo com apenas: Nome, CPF/CNPJ, Telefone, Credor e Estagio
- Botao de editar/adicionar contato visivel no cabecalho
- Card "Telefones" removido da pagina
- Funcionalidade de gerenciamento de telefones acessivel via dialog
