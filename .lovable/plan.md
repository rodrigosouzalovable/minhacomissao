## Editar cor das etiquetas direto no dropdown do filtro

Adicionar um lápis ao lado de cada etiqueta no menu de filtro (ícone de tag azul ao lado da busca no Inbox Meta), permitindo trocar cor e nome sem sair dali.

### Alterações

**`src/pages/InboxMeta.tsx`** (ou o componente do dropdown de filtro de etiquetas — a confirmar na hora do build)
- Em cada linha do dropdown "Todas as conversas / Atendente: ...", adicionar um ícone `Pencil` à direita (só visível para admin/owner da etiqueta).
- Clicar no lápis abre um mini-popover inline com:
  - Campo de texto para renomear
  - Paleta de 8 cores (mesma do diálogo atual)
  - Botões Salvar / Cancelar
- Clicar no lápis **não** seleciona o filtro (stopPropagation).
- Após salvar, invalidar a query `meta-etiquetas` para refletir na lista e nos badges das conversas.

### Regras
- Etiquetas automáticas (`auto_atendente = true`) — permitir só trocar cor, nome fica bloqueado (mantém a trava já existente).
- Não-admin não vê o lápis.

Sem migrações. Sem mudanças no diálogo `MetaEtiquetasDialog` existente (continua funcionando pelo botão `+`).