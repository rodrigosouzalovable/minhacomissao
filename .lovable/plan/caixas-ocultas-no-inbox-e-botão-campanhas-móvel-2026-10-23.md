# Caixas ocultas no Inbox e botão Campanhas móvel

## 1. Caixas Ocultas (Inbox Meta Oficial)
- Clique com o botão direito em qualquer caixa: nova opção **Ocultar caixa** (exceto Padrão, que nunca é ocultada).
- A caixa some da lista e passa a aparecer no novo botão **Caixas Ocultas**, depois da última caixa (ao lado do "+"), com o número de caixas ocultas.
- Clique no botão Caixas Ocultas: abre a lista das ocultas; clicar numa delas abre a caixa normalmente.
- Clique com o botão direito numa caixa dentro dessa lista: opção **Desocultar**, e ela volta para a lista principal. Também haverá **Desocultar todas**.
- Ocultar é só visual e pessoal: cada usuário oculta as próprias caixas, sem mudar permissões, conversas, etiquetas ou distribuição. Se estiver dentro de uma caixa ao ocultá-la, o sistema volta para a Padrão.
- A preferência fica salva no navegador de cada usuário (sem custo de servidor).

## 2. Botão Campanhas arrastável
- O botão Campanhas (canto inferior direito) poderá ser arrastado para qualquer ponto da tela, com mouse ou toque.
- Um clique simples continua abrindo as campanhas normalmente; só arrastar move o botão.
- A posição fica salva e é mantida ao trocar de página ou recarregar; o botão nunca sai da área visível, mesmo se a janela for redimensionada.

## Detalhes técnicos
- `src/pages/InboxMeta.tsx`: estado `caixasOcultas` em localStorage (`inbox-meta-caixas-ocultas:{userId}`); filtrar a lista de pastas; `ContextMenuItem` "Ocultar caixa" no menu já existente das caixas; novo botão com `Popover` listando as ocultas, cada uma com `ContextMenu` "Desocultar".
- `src/components/meta/CampanhasFlutuante.tsx`: trocar `fixed bottom-4 right-4` por posição controlada via pointer events (limiar de 5px para distinguir clique de arrasto), limitada ao viewport, salva em localStorage.
- Sem mudanças no banco, sem cron/polling — sem impacto de custo.
