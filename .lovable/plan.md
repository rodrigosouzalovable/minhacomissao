

## Plano: Portal Publico de Consulta de Debitos (Estilo Feirao de Acordos)

### Resumo

Criar um portal publico com a identidade visual do **Grupo Altum** onde clientes inadimplentes podem consultar seus debitos pelo CPF. O sistema atual de gestao interna fica em uma area restrita (login). O admin importa devedores via planilha Excel.

---

### Estrutura geral

O site tera duas areas:

1. **Area publica** (`/`) - Portal de consulta de debitos (sem login)
2. **Area restrita** (`/auth`, `/dashboard`, etc.) - Sistema atual de gestao (com login)

---

### Fase 1: Banco de Dados

#### Nova tabela `devedores`

Armazena os clientes inadimplentes importados pelo admin:

```text
devedores
- id (uuid, PK)
- nome (text)
- cpf (text, indexado)
- valor_original (numeric) - valor da divida original
- valor_atualizado (numeric) - valor atualizado com juros/multas
- descricao (text) - descricao do debito (ex: "Cartao de Credito", "Emprestimo")
- contrato (text) - numero do contrato
- data_vencimento (date) - data do vencimento original
- importado_por (uuid) - user_id do admin que importou
- arquivo_importacao (text) - nome do arquivo de origem
- ativo (boolean, default true) - se o debito ainda esta disponivel para consulta
- criado_em (timestamptz)
- atualizado_em (timestamptz)
```

**RLS**: SELECT publico (qualquer pessoa pode consultar por CPF via funcao SECURITY DEFINER), INSERT/UPDATE/DELETE somente admins.

#### Funcao SECURITY DEFINER `consultar_debitos_por_cpf(p_cpf text)`

Retorna os debitos ativos de um CPF, sem exigir autenticacao. Isso evita expor a tabela diretamente e limita a consulta a um CPF por vez.

---

### Fase 2: Importacao via Excel (Admin)

#### Nova pagina `src/pages/ImportarDevedores.tsx`

Acessivel apenas por admins (`/admin/importar-devedores`). Funcionalidades:

- Upload de arquivo Excel (.xlsx)
- Preview dos dados antes de confirmar importacao
- Mapeamento de colunas (nome, CPF, valor, descricao, contrato, data vencimento)
- Insercao em lote na tabela `devedores`
- Historico de importacoes com possibilidade de remover lote inteiro

#### Menu lateral

Adicionar link "Importar Devedores" no menu admin do `AppLayout.tsx`.

---

### Fase 3: Portal Publico

#### Nova pagina `src/pages/PortalConsulta.tsx` (rota `/`)

Landing page com identidade visual do Grupo Altum:

- **Header**: Logo do Grupo Altum, telefone de contato (62) 98108-9329
- **Hero section**: Titulo "Consulte seus debitos", campo de CPF centralizado
- **Como funciona**: 3 passos (Consulte seu CPF -> Veja seus debitos -> Entre em contato)
- **Beneficios**: Condicoes especiais, negociacao facilitada
- **Footer**: Informacoes de contato, telefone/WhatsApp

#### Fluxo do cliente:

1. Acessa o site, digita o CPF
2. Sistema consulta via RPC `consultar_debitos_por_cpf`
3. Se encontrar debitos: exibe cards com detalhes (descricao, valor, vencimento)
4. Cada card tem botao "Negociar" que abre link do WhatsApp para o numero (62) 98108-9329 com mensagem pre-preenchida
5. Se nao encontrar: mensagem "Nenhum debito encontrado para este CPF"

#### Nova pagina `src/pages/ConsultaResultado.tsx` (rota `/consulta/:cpf`)

Exibe os resultados da consulta com os debitos encontrados.

---

### Fase 4: Roteamento

#### Atualizar `App.tsx`

- Rota `/` -> `PortalConsulta` (publica, sem autenticacao)
- Rota `/consulta/:cpf` -> `ConsultaResultado` (publica)
- Rota `/auth` -> Login (area restrita)
- Link discreto no portal publico: "Area Restrita" que leva ao `/auth`
- Todas as rotas atuais permanecem iguais

---

### Fase 5: Identidade Visual

- Cores do Grupo Altum (azul escuro #003366 como primaria, verde como accent)
- Logo do Grupo Altum no header do portal publico (usaremos a URL da imagem do site deles ou voce pode fazer upload)
- Design moderno e limpo, responsivo para mobile
- Area restrita mantem o visual atual

---

### Detalhes Tecnicos

**Arquivos criados:**
- `src/pages/PortalConsulta.tsx` - Landing page publica
- `src/pages/ConsultaResultado.tsx` - Resultados da consulta
- `src/pages/ImportarDevedores.tsx` - Importacao de planilha (admin)
- Migracao SQL para tabela `devedores` + funcao RPC + politicas RLS

**Arquivos modificados:**
- `src/App.tsx` - Novas rotas publicas
- `src/components/layout/AppLayout.tsx` - Link admin para importacao

**Dependencias:** Nenhuma nova. Ja temos `xlsx` para leitura de Excel e todos os componentes UI necessarios.

**Seguranca:**
- A consulta publica usa uma funcao `SECURITY DEFINER` que retorna apenas dados nao-sensiveis
- Rate limiting pode ser adicionado futuramente
- CPF e validado antes da consulta
- A tabela `devedores` tem RLS restrito: somente admins podem inserir/editar/deletar

