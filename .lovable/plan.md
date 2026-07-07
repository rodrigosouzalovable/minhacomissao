## Alterações em `src/components/inbox/meta/MetaNovaConversaDialog.tsx`

### 1. Filtrar templates pela instância selecionada
- Mover a busca de templates para dentro de um `useEffect` que depende de `instId` (além de `open`).
- Adicionar `.eq('instancia_id', instId)` na query, executando somente quando houver instância selecionada.
- Incluir `body_text` e `variaveis` no `select` (para o preview).
- Ao trocar a instância, limpar `templateName` para evitar template órfão.

### 2. Preview da mensagem do template
- Após selecionar o template, exibir um card com o `body_text` renderizado.
- Substituir placeholders `{{1}}`, `{{name}}` etc. usando:
  - `{{name}}` / `{{1}}` → campo Nome (fallback: "Cliente").
- Estilo: bloco discreto (`bg-muted rounded-md p-3 text-sm whitespace-pre-wrap`) com rótulo "Pré-visualização".
- Atualiza em tempo real conforme o usuário digita o nome ou troca o template.

Nenhuma mudança de backend, schema ou RLS.
