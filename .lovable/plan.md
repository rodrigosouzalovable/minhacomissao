

## Ficha do Devedor com Agrupamento por CPF e Sistema de Eventos

### Resumo
Implementar tres funcionalidades principais: (1) botao para agrupar linhas duplicadas por CPF/CNPJ no preview da importacao, somando valores; (2) pagina de ficha individual do devedor com contratos expandiveis; (3) sistema de eventos com tipos "Contato com Cliente" e "Anexar Arquivo" (com upload de arquivo).

---

### 1. Alteracoes no Banco de Dados

**Nova tabela: `devedor_eventos`**

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid (PK) | Identificador unico |
| devedor_id | uuid (FK -> devedores.id ON DELETE CASCADE) | Vinculo com o devedor |
| tipo | text | Tipo do evento (contato_cliente, anexar_arquivo) |
| descricao | text | Observacao/descricao do evento |
| arquivo_url | text (nullable) | URL do arquivo anexado (se aplicavel) |
| arquivo_nome | text (nullable) | Nome original do arquivo |
| criado_por | uuid | ID do usuario que registrou |
| criado_em | timestamptz | Data/hora do registro |

RLS: admins podem gerenciar (ALL), usuarios autenticados podem visualizar (SELECT).

**Storage bucket: `devedor-arquivos`**
- Bucket privado para armazenar arquivos anexados aos eventos dos devedores.

---

### 2. Agrupamento por CPF/CNPJ no Preview (ImportarDevedores.tsx)

- Adicionar um botao "Agrupar por CPF/CNPJ" acima da tabela de preview
- Ao clicar, as linhas com mesmo CPF sao agrupadas em um unico card/linha mostrando:
  - CPF/CNPJ, Nome, Quantidade de contratos, Valor total (soma dos valores)
- Toggle para alternar entre visualizacao agrupada e visualizacao detalhada (tabela original)
- Na visualizacao agrupada, cada card tera um botao "Ver Ficha" que navega para a pagina de detalhe

---

### 3. Nova Pagina: Ficha do Devedor (`/clientes/:id`)

Layout baseado nas imagens de referencia:

**Cabecalho**
- Nome do cliente em destaque
- CPF/CNPJ abaixo do nome
- Telefone(s)
- Botao "Voltar"

**Secao Contratos (lado esquerdo)**
- Titulo "Contratos" com "Total em Atraso R$ X.XXX,XX" em destaque (vermelho/verde)
- Lista de contratos expandiveis (Collapsible/Accordion):
  - Cada linha mostra: numero do contrato, atraso (dias), vencimento
  - Ao expandir: tabela com Numero da parcela, Vencimento, Valor, Atraso, Status
- Botao para ocultar/exibir detalhes de cada contrato

**Secao Eventos (lado direito)**
- Titulo "Eventos" com botao "+ Novo Evento"
- Ao clicar, abre um Dialog com:
  - Select de Evento: "Contato com Cliente", "Anexar Arquivo"
  - Se "Anexar Arquivo" selecionado: campo de upload de arquivo aparece
  - Campo de texto (Textarea) para descricao/observacao
  - Botoes "Fechar" e "Salvar"
- Lista de eventos anteriores em ordem cronologica (mais recente primeiro)
- Cada evento mostra: tipo (badge), descricao, data/hora, nome do usuario
- Eventos de arquivo mostram link para download

---

### 4. Alteracoes no Roteamento (App.tsx)

- Adicionar rota `/clientes/:id` para a nova pagina `DevedorDetalhe.tsx`
- Protegida por `ProtectedRoute`

---

### 5. Arquivos a Criar/Modificar

| Arquivo | Acao |
|---|---|
| `supabase/migrations/...` | Criar tabela `devedor_eventos` + storage bucket |
| `src/pages/DevedorDetalhe.tsx` | **Criar** - Pagina completa da ficha do devedor |
| `src/pages/ImportarDevedores.tsx` | **Modificar** - Adicionar botao de agrupamento e link para ficha |
| `src/App.tsx` | **Modificar** - Adicionar rota `/clientes/:id` |

---

### Secao Tecnica

**Agrupamento no frontend (ImportarDevedores.tsx):**
- Estado `grouped: boolean` para alternar visualizacao
- Funcao que agrupa `rows` por CPF usando `reduce`, somando `valor_original` e contando contratos
- Cards com resumo + botao "Ver Ficha" que busca o devedor no banco por CPF

**Ficha do Devedor (DevedorDetalhe.tsx):**
- Busca todos os registros de `devedores` com o mesmo `id` ou `cpf` para listar contratos
- Usa `Collapsible` do Radix para expandir/recolher contratos
- Busca eventos da tabela `devedor_eventos` ordenados por `criado_em DESC`
- Upload de arquivo via Lovable Cloud Storage para o bucket `devedor-arquivos`

**Fluxo de Eventos:**
1. Usuario clica "+ Novo Evento"
2. Seleciona tipo (Contato com Cliente ou Anexar Arquivo)
3. Se Anexar Arquivo: seleciona o arquivo via input file
4. Escreve a descricao/observacao
5. Clica "Salvar" -> upload do arquivo (se houver) + insert na tabela `devedor_eventos`
6. Lista de eventos atualiza automaticamente

