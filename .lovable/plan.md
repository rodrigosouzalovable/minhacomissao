

## Adicionar botao "Editar" no dropdown de telefones cadastrados

### Objetivo

Adicionar a opcao "Editar" no menu de acoes dos telefones ja cadastrados na tabela `devedor_telefones`, permitindo alterar todos os campos (numero, tipo, whatsapp, contato, ativo, autorizado, observacao, ramal).

### Abordagem

Reutilizar o `TelefoneDialog` existente, adicionando suporte ao modo de edicao (UPDATE) alem do modo de criacao (INSERT).

### Modificacoes

**`src/components/devedor/TelefoneDialog.tsx`**:
- Adicionar prop opcional `editData` contendo o telefone completo (id, numero, tipo, is_contato, is_whatsapp, ativo, autorizado, observacao, ramal)
- Quando `editData` for fornecido, pre-preencher todos os campos do formulario ao abrir
- Alterar o `handleSave` para fazer UPDATE (quando `editData.id` existir) em vez de INSERT
- Alterar o titulo do dialog para "Editar Telefone" quando em modo edicao

**`src/components/devedor/TelefoneTab.tsx`**:
- Adicionar estado `editTelefone` para armazenar o telefone sendo editado
- Adicionar opcao "Editar" no dropdown dos telefones cadastrados (nao-importados), antes de "Inativar"
- Ao clicar em "Editar", setar `editTelefone` com os dados do telefone e abrir o dialog
- Passar `editData` para o `TelefoneDialog`
- Limpar `editTelefone` ao fechar o dialog

### RLS

A tabela `devedor_telefones` precisa de uma policy de UPDATE. Sera adicionada uma migracao:
- UPDATE policy para usuarios autenticados (mesma logica das policies existentes de INSERT/SELECT)

### Resumo de arquivos

| Arquivo | Alteracao |
|---|---|
| Migracao SQL | Adicionar RLS UPDATE em devedor_telefones |
| src/components/devedor/TelefoneDialog.tsx | Suporte a modo edicao com prop editData e logica UPDATE |
| src/components/devedor/TelefoneTab.tsx | Opcao "Editar" no dropdown, estado editTelefone |
