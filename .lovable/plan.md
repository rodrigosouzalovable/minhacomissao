

## Implantacao Completa: Ficha do Devedor + Agrupamento + Eventos

### Resumo
Finalizar a implementacao das tres funcionalidades aprovadas: (1) tabela e bucket no banco de dados, (2) agrupamento por CPF no preview de importacao, (3) pagina de ficha do devedor com contratos expandiveis e sistema de eventos.

---

### 1. Migracao no Banco de Dados

Criar a tabela `devedor_eventos` e o bucket de storage `devedor-arquivos`:

```text
devedor_eventos
-----------------------------------------
id           | uuid PK
devedor_id   | uuid FK -> devedores(id) ON DELETE CASCADE
tipo         | text (contato_cliente, anexar_arquivo)
descricao    | text
arquivo_url  | text (nullable)
arquivo_nome | text (nullable)
criado_por   | uuid
criado_em    | timestamptz
```

- RLS: admins gerenciam tudo (ALL), usuarios autenticados podem ver (SELECT) e criar (INSERT)
- Bucket `devedor-arquivos` privado com politicas de upload/download para usuarios autenticados

---

### 2. Modificar ImportarDevedores.tsx

- Adicionar estado `grouped` (boolean) e botao "Agrupar por CPF/CNPJ" no preview
- Quando ativado, agrupar linhas por CPF usando `reduce`:
  - Mostrar: CPF, Nome, Qtd Contratos, Valor Total
  - Cada linha agrupada tera botao "Ver Ficha" (navega para `/clientes/:cpf` apos importacao)
- Manter toggle para alternar entre visao detalhada e agrupada

---

### 3. Criar pagina DevedorDetalhe.tsx (`/clientes/:id`)

**Cabecalho:**
- Nome, CPF/CNPJ, telefone, botao Voltar

**Secao Contratos (esquerda):**
- Total em atraso em destaque
- Lista de contratos usando `Collapsible` (Radix)
- Cada contrato mostra: numero, vencimento, valor
- Botao ocultar/exibir por contrato

**Secao Eventos (direita):**
- Botao "+ Novo Evento" abre Dialog
- Select tipo: "Contato com Cliente" ou "Anexar Arquivo"
- Se "Anexar Arquivo": campo de upload aparece
- Textarea para observacao
- Lista de eventos anteriores (cronologico DESC)
- Eventos de arquivo com link de download

---

### 4. Modificar App.tsx

- Adicionar rota `/clientes/:id` com ProtectedRoute e componente DevedorDetalhe

---

### 5. Modificar Clientes.tsx

- Adicionar botao "Ver Ficha" em cada linha da tabela de resultados, navegando para `/clientes/:id`

---

### Arquivos envolvidos

| Arquivo | Acao |
|---|---|
| Migracao SQL | Criar tabela devedor_eventos + bucket |
| src/pages/DevedorDetalhe.tsx | Criar (pagina completa) |
| src/pages/ImportarDevedores.tsx | Modificar (agrupamento) |
| src/pages/Clientes.tsx | Modificar (botao ver ficha) |
| src/App.tsx | Modificar (nova rota) |

