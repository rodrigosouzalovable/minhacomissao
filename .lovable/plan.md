

## Reformular Layout da Ficha do Cliente + Registro de Telefones

### Resumo

Redesenhar a pagina `DevedorDetalhe.tsx` para seguir o layout da imagem de referencia, com tres areas principais: cabecalho com dados do cliente, area central com abas (Telefone, Dados) e contratos abaixo, e coluna direita com eventos. Tambem criar uma tabela `devedor_telefones` para armazenar telefones cadastrados.

---

### 1. Migracao do Banco de Dados

**Nova tabela `devedor_telefones`:**

```text
devedor_telefones
-----------------------------------------
id              | uuid PK default gen_random_uuid()
devedor_cpf     | text NOT NULL (CPF normalizado, para vincular todos os contratos do mesmo cliente)
numero          | text NOT NULL
tipo            | text NOT NULL DEFAULT 'celular' (celular, comercial, residencial, outro)
is_contato      | boolean DEFAULT false
is_whatsapp     | boolean DEFAULT false
ativo           | boolean DEFAULT true
autorizado      | boolean DEFAULT true
observacao      | text
ramal           | text
criado_por      | uuid NOT NULL
criado_em       | timestamptz DEFAULT now()
```

RLS: admins ALL, autenticados SELECT/INSERT/UPDATE.

---

### 2. Redesenhar src/pages/DevedorDetalhe.tsx

**Cabecalho (topo):**
- Nome do cliente em destaque (grande)
- CPF/CNPJ, Endereco (se houver), botao "Voltar" no canto direito
- Layout horizontal similar a referencia

**Area Central - Abas (usando Tabs):**
- **Aba "Telefone"**: tabela com colunas Numero, Tipo, Observacao, e dropdown "Acao" (Inativar, Excluir). Botao "+ Novo" abre dialog de cadastro de telefone.
- **Aba "Dados"**: informacoes gerais do devedor (credor, descricao, etc.)

**Dialog "Telefone Novo" (ao clicar em "+ Novo"):**
- Campos em grid 3 colunas:
  - Telefone (input)
  - Tel. de Contato (Sim/Nao radio)
  - Ativo (Sim/Nao radio)
  - Tipo de Telefone (select: Celular, Comercial, Residencial, Outro)
  - Whatsapp (Sim/Nao radio)
  - Autorizado (Sim/Nao radio)
  - Observacao (textarea)
  - Ramal (input)
- Botoes "Fechar" e "Salvar"

**Secao Contratos (abaixo das abas):**
- Titulo "Contratos" com "Total em Atraso R$ X" em vermelho ao lado
- Lista compacta: cada contrato mostra numero, dias de atraso, data de negociacao
- Linhas expandiveis (collapsible) para ver detalhes

**Coluna Direita - Eventos (permanece similar):**
- Botao "+ Novo Evento" no topo
- Timeline de eventos com tipo, descricao, data/hora e autor

---

### 3. Detalhes Tecnicos

- Buscar telefones por CPF normalizado (nao por devedor_id) para que todos os contratos do mesmo cliente compartilhem os mesmos telefones
- Calcular "dias de atraso" a partir de `data_vencimento` usando `differenceInDays(new Date(), vencimento)`
- Usar `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` do Radix para as abas
- Usar `DropdownMenu` para o botao "Acao" em cada telefone
- Formatacao de telefone no input com mascara `(00) 00000-0000`

### Arquivos envolvidos

| Arquivo | Acao |
|---|---|
| Migracao SQL | Criar tabela devedor_telefones + RLS |
| src/pages/DevedorDetalhe.tsx | Reescrever layout completo |

