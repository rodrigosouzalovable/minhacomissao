

## Plano: Botão de edição de permissões e empresa por funcionário

### O que será feito

Adicionar um botão "Editar" ao lado do botão de remover (lixeira) na coluna "Ações" da tabela de equipes. Ao clicar, abre um dialog onde o admin pode:

1. **Selecionar quais abas** da barra lateral o funcionário pode ver (checkboxes)
2. **Selecionar a empresa vinculada** ao funcionário (dropdown)

### Banco de Dados

Criar uma nova tabela `user_permissions` para armazenar as configurações por usuário:

```text
user_permissions
- id (uuid, PK)
- user_id (uuid, referência ao profiles.id)
- abas_permitidas (text[], array com os paths permitidos)
- empresa (text, 'ume_novo_mundo' ou 'mundo_da_moda')
- criado_em (timestamp)
- atualizado_em (timestamp)
```

Politicas RLS:
- Admins podem gerenciar todas as permissões (ALL)
- Usuários podem ver suas próprias permissões (SELECT)

### Abas disponíveis para configuração

As abas de funcionário que podem ser ativadas/desativadas:

| Aba | Path |
|-----|------|
| Minha Conta | /conta |
| Dashboard | /dashboard |
| Meus Acordos | /acordos |
| Novo Acordo | /acordos/novo |
| Retornos | /retornos |
| Minhas Comissões | /comissoes |

### Empresas disponíveis

- UME / NOVO MUNDO (`ume_novo_mundo`)
- MUNDO DA MODA (`mundo_da_moda`)

### Alterações em arquivos

**1. Nova tabela (migração SQL)**
- Criar tabela `user_permissions` com RLS

**2. `src/pages/AdminEquipes.tsx`**
- Adicionar botão "Editar" (ícone lápis) ao lado do botão de remover na coluna Ações
- Criar um Dialog com:
  - Checkboxes para cada aba disponível
  - Select para empresa vinculada
  - Botão Salvar
- Buscar e salvar dados na tabela `user_permissions`

**3. `src/components/layout/AppLayout.tsx`**
- Buscar as permissões do usuário logado da tabela `user_permissions`
- Filtrar os `navItems` com base nas `abas_permitidas` do usuário
- Admins continuam vendo tudo (sem restrição)
- Se o usuário não tiver registro em `user_permissions`, mostrar todas as abas padrão de funcionário

### Fluxo

1. Admin acessa Equipes
2. Clica no botão "Editar" ao lado de um funcionário
3. Dialog abre com checkboxes das abas e dropdown de empresa
4. Admin marca/desmarca abas e seleciona empresa
5. Ao salvar, grava na tabela `user_permissions`
6. Quando o funcionário faz login, o sidebar filtra as abas com base nas permissões salvas

