

## Implantacao Completa - Ficha do Devedor, Agrupamento e Eventos

### Resumo

Executar todas as etapas pendentes de uma vez: migracao do banco, criacao da pagina de ficha do devedor, agrupamento no preview de importacao, e botao "Ver Ficha" na pagina de clientes.

---

### 1. Migracao do Banco de Dados

Criar tabela `devedor_eventos` e bucket `devedor-arquivos` com RLS:

```text
devedor_eventos
-----------------------------------------
id           | uuid PK default gen_random_uuid()
devedor_id   | uuid FK -> devedores(id) ON DELETE CASCADE
tipo         | text NOT NULL
descricao    | text NOT NULL DEFAULT ''
arquivo_url  | text (nullable)
arquivo_nome | text (nullable)
criado_por   | uuid NOT NULL
criado_em    | timestamptz NOT NULL DEFAULT now()
```

Politicas RLS:
- Admins: ALL (usando has_role)
- Usuarios autenticados: SELECT e INSERT
- Anonimos: bloqueados

Bucket `devedor-arquivos` (privado) com politicas de upload e download para usuarios autenticados.

---

### 2. Criar src/pages/DevedorDetalhe.tsx

Pagina `/clientes/:id` com layout em duas colunas:

**Cabecalho:**
- Nome, CPF/CNPJ, telefone, botao Voltar

**Coluna Esquerda - Contratos:**
- Card com "Total em Atraso" em destaque
- Lista de contratos do mesmo CPF (busca em `devedores` por CPF normalizado)
- Cada contrato usa Collapsible: mostra numero, vencimento, valor
- Botao para expandir/recolher

**Coluna Direita - Eventos:**
- Botao "+ Novo Evento" abre Dialog
- Select: "Contato com Cliente" ou "Anexar Arquivo"
- Se "Anexar Arquivo": input de upload aparece
- Textarea para observacao
- Ao salvar: upload do arquivo ao bucket (se houver) + insert em devedor_eventos
- Lista de eventos anteriores (DESC por criado_em)
- Eventos de arquivo com link de download

---

### 3. Modificar src/pages/ImportarDevedores.tsx

- Adicionar estado `grouped` (boolean) e botao "Agrupar por CPF/CNPJ" no cabecalho do preview
- Quando ativado, agrupar `rows` por CPF usando reduce:
  - Exibir: CPF, Nome, Qtd Contratos, Valor Total
  - Cada card com botao "Ver Ficha" (navega para `/clientes/:devedorId` buscando por CPF)
- Toggle para alternar entre visao detalhada e agrupada

---

### 4. Modificar src/pages/Clientes.tsx

- Adicionar coluna "Acoes" na tabela de resultados
- Botao "Ver Ficha" em cada linha, navegando para `/clientes/:id`

---

### 5. Modificar src/App.tsx

- Importar DevedorDetalhe
- Adicionar rota `/clientes/:id` com ProtectedRoute

---

### Arquivos envolvidos

| Arquivo | Acao |
|---|---|
| Migracao SQL | Criar tabela + bucket + RLS |
| src/pages/DevedorDetalhe.tsx | Criar |
| src/pages/ImportarDevedores.tsx | Modificar (agrupamento CPF) |
| src/pages/Clientes.tsx | Modificar (botao Ver Ficha + coluna Acoes) |
| src/App.tsx | Modificar (nova rota) |

