# Corrigir a configuração de etiquetas (Inbox Meta)

## O que está acontecendo

Existem **14 etiquetas** cadastradas no banco, mas a janela "Etiquetas Meta" mostra apenas 4. Dois problemas confirmados:

1. **Lista filtrada por engano.** A janela de gerenciamento é aberta pelo menu de contexto da conversa e recebe a mesma lista reduzida usada no submenu "Etiquetas" — que propositalmente esconde etiquetas de atendentes que não pertencem à caixa ativa. Resultado: na caixa AMARAL sobram só 4 itens na tela de configuração.
2. **Edição bloqueada para etiquetas de outros.** A regra de acesso do banco só permite renomear/trocar cor de etiquetas criadas pelo próprio usuário. Etiquetas criadas por outro usuário (ex.: "Enviar boleto" e "Pendente", criadas pela Anna Flavia) não salvam alteração, mesmo no login admin.

## O que será feito

**1. Mostrar todas as etiquetas na janela de configuração**
- O submenu "Etiquetas" (aplicar em uma conversa) continua filtrado por caixa, como hoje.
- A janela "Etiquetas Meta" passa a receber a lista **completa**, para você ver, renomear, trocar cor e excluir qualquer etiqueta.

**2. Permitir editar nome e cor de qualquer etiqueta (admin)**
- Ajuste da regra de acesso: admin pode atualizar e excluir qualquer etiqueta da empresa; os demais continuam limitados às próprias (e a trava atual de etiqueta automática de atendente é mantida).

**3. Feedback de erro na edição**
- Se uma alteração não for permitida, a janela mostra aviso claro em vez de fechar sem salvar.

## Detalhes técnicos

- `src/pages/InboxMeta.tsx`: passar `etiquetas` (completo) para `MetaConversaContextMenu` em uma nova prop `etiquetasGerenciar`, mantendo `etiquetas={etiquetasMenu}` para o submenu.
- `src/components/inbox/meta/MetaConversaContextMenu.tsx`: usar `etiquetasGerenciar ?? etiquetas` no `MetaEtiquetasDialog`.
- `src/components/inbox/meta/MetaEtiquetasDialog.tsx`: em `salvarEdicao`, tratar retorno com 0 linhas afetadas como erro de permissão e exibir toast.
- Migração: substituir `meta_etiquetas_owner_update` / `meta_etiquetas_owner_delete` por versões que também aceitem `is_admin_user(auth.uid())`, preservando o bloqueio de exclusão de etiquetas com vínculo `origem = 'auto_atendente'` para não-admins.

## Observação

Há duplicidades no cadastro: "Enviar Boleto" e "Enviar boleto" (duas etiquetas verdes/amarelas parecidas) e duas "Atendente: Gabriel". Depois do ajuste você poderá renomeá-las ou excluí-las direto na janela — posso também limpar as duplicatas se você quiser.
