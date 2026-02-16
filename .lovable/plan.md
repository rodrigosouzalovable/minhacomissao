
## Mostrar Telefone Importado + Editar/Excluir Eventos

### 1. Telefone importado na aba Telefone

Atualmente, o campo `devedor.telefone` (telefone que veio na importacao da planilha) aparece apenas no cabecalho. Na aba "Telefone", so aparecem registros da tabela `devedor_telefones`.

**Solucao**: No `TelefoneTab`, receber uma nova prop `telefoneImportado` (string | null). Se existir e nao houver nenhum registro em `devedor_telefones` com o mesmo numero, exibir esse telefone como primeira linha da tabela com uma Badge "Importado" e sem acoes de edicao/exclusao (pois vem do registro original).

**Modificacoes em `src/components/devedor/TelefoneTab.tsx`**:
- Adicionar prop `telefoneImportado?: string | null`
- Criar uma lista combinada: se `telefoneImportado` existir e seu numero normalizado nao estiver na lista de `telefones`, inserir um item virtual no inicio com tipo "celular", observacao "Importado", sem id
- Exibir esse item com Badge "Importado" e sem dropdown de acao

**Modificacoes em `src/pages/DevedorDetalhe.tsx`**:
- Passar `telefoneImportado={devedor.telefone}` para o componente `TelefoneTab`

---

### 2. Editar e Excluir eventos

Atualmente cada evento e exibido sem opcoes de edicao ou exclusao.

**Solucao**: Adicionar um `DropdownMenu` com opcoes "Editar" e "Excluir" em cada card de evento.

**Modificacoes em `src/pages/DevedorDetalhe.tsx`**:
- Adicionar estado para controlar dialog de edicao de evento (`editEventoId`, `editEventoTipo`, `editEventoDescricao`)
- Adicionar funcao `handleDeleteEvento(eventoId)` que faz DELETE na tabela `devedor_eventos` e recarrega
- Adicionar funcao `handleEditEvento()` que faz UPDATE na tabela `devedor_eventos` com o tipo e descricao editados
- Em cada card de evento, adicionar um `DropdownMenu` (icone tres pontos) com:
  - "Editar" - abre dialog de edicao pre-preenchido
  - "Excluir" - executa exclusao com confirmacao via toast
- Criar um Dialog de edicao (reutilizando o mesmo layout do dialog de criacao) que permite alterar tipo e descricao do evento

**RLS necessario**: A tabela `devedor_eventos` ja tem politica de INSERT e SELECT para usuarios autenticados, mas nao tem UPDATE nem DELETE. Sera necessaria uma migracao para adicionar:
- UPDATE policy: usuario autenticado pode atualizar eventos que ele criou (`auth.uid() = criado_por`)
- DELETE policy: usuario autenticado pode excluir eventos que ele criou (`auth.uid() = criado_por`)

---

### Resumo de arquivos

| Arquivo | Acao |
|---|---|
| Migracao SQL | Adicionar RLS UPDATE + DELETE em devedor_eventos para o criador |
| src/components/devedor/TelefoneTab.tsx | Adicionar prop telefoneImportado e exibir na tabela |
| src/pages/DevedorDetalhe.tsx | Passar telefoneImportado, adicionar editar/excluir eventos com dialogs |
