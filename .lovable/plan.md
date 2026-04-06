

## Plano: Menu de contexto com "Marcar como Não Lida" e Etiquetas no Inbox

### O que será feito

Ao clicar com o botão direito em uma conversa na lista lateral do Inbox, abrirá um menu de contexto (como no WhatsApp Web) com duas opções:
1. **Marcar como não lida** — seta `nao_lido` para 1 no contato
2. **Etiquetar conversa** — submenu com etiquetas coloridas criadas pelo usuário

### Alterações

**1. Migration SQL**

- Criar tabela `whatsapp_etiquetas` (id, user_id, nome, cor, criado_em) — etiquetas personalizadas do usuário
- Criar tabela `whatsapp_contato_etiquetas` (id, contato_id FK, etiqueta_id FK) — relação N:N
- RLS: usuários autenticados podem CRUD nas suas próprias etiquetas; admin e inbox compartilhado podem ver todas
- Habilitar realtime na tabela de etiquetas dos contatos

**2. Componente `ConversaContextMenu.tsx`**

- Usa `ContextMenu` (já existe no projeto via Radix)
- Envolve cada item de conversa na lista
- Opções:
  - "Marcar como não lida" — faz `UPDATE whatsapp_contatos SET nao_lido = 1 WHERE id = contatoId`
  - "Etiquetas" → submenu listando etiquetas do usuário com checkbox (toggle on/off)
  - "Gerenciar etiquetas" → abre dialog para criar/editar/excluir etiquetas (nome + cor)

**3. Componente `GerenciarEtiquetasDialog.tsx`**

- Dialog para criar novas etiquetas com nome e cor (palette de ~8 cores pré-definidas)
- Listar etiquetas existentes com opção de renomear ou excluir

**4. Atualizar `WhatsAppInbox.tsx`**

- Envolver cada `<button>` de contato com `<ConversaContextMenu>`
- Buscar etiquetas do usuário e etiquetas atribuídas a contatos
- Exibir badges coloridos das etiquetas ao lado do nome do contato na lista
- Adicionar filtro opcional por etiqueta no cabeçalho da lista

**5. Atualizar interface `Contato`**

- Adicionar campo `etiquetas` (array de {id, nome, cor}) populado via join

### Detalhes técnicos

- Tabelas novas:

```text
whatsapp_etiquetas
├── id (uuid PK)
├── user_id (uuid, ref auth.users)
├── nome (text)
├── cor (text, ex: '#25D366')
└── criado_em (timestamptz)

whatsapp_contato_etiquetas
├── id (uuid PK)
├── contato_id (uuid FK → whatsapp_contatos)
├── etiqueta_id (uuid FK → whatsapp_etiquetas)
└── unique(contato_id, etiqueta_id)
```

- O "Marcar como não lida" apenas seta `nao_lido = 1` — a lógica existente já trata contatos com `nao_lido > 0` como não lidos (badge, ordenação)
- As etiquetas aparecem como pequenos badges coloridos abaixo da última mensagem no item da conversa
- O ContextMenu usa os componentes Radix já importados no projeto (`src/components/ui/context-menu.tsx`)

Arquivos afetados:
- Nova migration SQL (2 tabelas + RLS)
- Novo: `src/components/inbox/ConversaContextMenu.tsx`
- Novo: `src/components/inbox/GerenciarEtiquetasDialog.tsx`
- Editado: `src/pages/WhatsAppInbox.tsx`

