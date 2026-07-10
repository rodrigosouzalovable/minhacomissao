## Objetivo

Quando a janela de 24h estiver fechada, clicar na área de digitação bloqueada abre um seletor de templates **UTILITY aprovados** para reabrir a conversa. Marketing nunca aparece.

## Comportamento

- Composer travado (estado `fechada`) vira um botão/área clicável estilizada como input.
- Clique abre um `Dialog` "Reabrir conversa com template UTILITY".
- Lista somente templates da instância atual com `categoria = 'UTILITY'` e `status = 'approved'`.
- Cada item mostra: nome, idioma, preview do corpo (com variáveis substituídas quando possível pelo nome do contato).
- Selecionar um template → abre painel de preenchimento de variáveis (reutilizando `EditarVariaveisTemplateDialog` ou inline simples) → botão "Enviar template".
- Envio chama a mesma edge function usada hoje no envio de template (`send-whatsapp-meta` ou fluxo já existente no Inbox Meta para templates).
- Após envio bem-sucedido: fecha diálogo, injeta mensagem otimista, mantém badge/banner (janela só reabre quando o cliente responder — mensagens de saída de template NÃO reabrem a janela de 24h; deixamos isso claro num aviso no diálogo).
- Estados: loading templates, vazio ("Nenhum template UTILITY aprovado — cadastre em Meta Templates"), erro.

## Barreiras mantidas

- Attachments, áudio e digitação livre continuam bloqueados quando `fechada`.
- Backend `send-whatsapp-meta-text` / `-media` continuam retornando 403 fora da janela — o novo fluxo usa envio por template, que é permitido.
- Marketing filtrado tanto no cliente (`WHERE categoria='UTILITY'`) quanto ocultado visualmente.

## Arquivos afetados

- `src/pages/InboxMeta.tsx` — trocar a área do composer quando `janelaInfo.status === 'fechada'` por um botão que abre o novo diálogo; passar `instancia_id`, `telefone`, `contato_nome` como props.
- `src/components/inbox/meta/ReabrirComTemplateDialog.tsx` (novo) — lista templates UTILITY approved, preview, preenchimento de variáveis, envio.
- Reutilizar helpers/edge function de envio de template já existentes (checar `MetaTemplates.tsx` / `send-whatsapp-meta`); nenhuma nova edge function.

## Detalhes técnicos

- Query: `meta_whatsapp_templates` filtrando `instancia_id = X AND categoria = 'UTILITY' AND status = 'approved'`.
- Variáveis vêm de `variaveis` (jsonb). Auto-preencher `{{1}}`/`nome` com primeiro nome do contato quando existir.
- Aviso no rodapé do diálogo: "Enviar template UTILITY cobra ~US$ 0,008 e NÃO reabre a janela de 24h — ela só reabre quando o cliente responder."
- Badge/banner de "Fechada" não muda após envio; volta a "aberta" só quando chegar `direcao='entrada'` nova.

## Fora do escopo

- Nenhuma mudança em backend/RLS/edge functions.
- Nenhuma mudança em envio em massa ou em templates de marketing.
