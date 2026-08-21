# Filtro por qualificações no Inbox Meta Oficial

## O que muda

Ao lado do botão de etiqueta (na linha da busca por nome/telefone), entra um novo botão quadrado com ícone de qualificação (`Tags`/`Bookmark`).

- Ao clicar, abre um painel com todas as qualificações ativas do sistema (pais e sub-marcadores, com a bolinha de cor de cada um).
- Seleção múltipla por clique (caixinha marcada/desmarcada), com contador e botão "Limpar".
- Com uma ou mais qualificações selecionadas, a lista de conversas mostra apenas os contatos que têm pelo menos uma dessas qualificações lançadas.
- Sem seleção = comportamento atual (todas as conversas).
- O botão fica destacado (variant `default`) quando há filtro ativo, e mostra o número de marcadores selecionados.
- Funciona em conjunto com os filtros já existentes: busca, etiqueta, Todas/Não lidas, janela 24h, caixas e modo "Meus Clientes".

## Detalhes técnicos

- Arquivo: `src/pages/InboxMeta.tsx`.
- Novos estados locais: `filtroQualifs: Set<string>` e `filtroQualifOpen: boolean`.
- Novo botão + `Popover` logo após o `Popover` do filtro de etiquetas (linhas ~1473-1478), reusando o mesmo padrão visual do seletor de marcadores já existente no bloco "Meus Clientes" (ícones `CheckSquare`/`Square`, já importados).
- Filtro aplicado no memo `contatosFiltrados` (linhas ~960-1029): quando `filtroQualifs.size > 0`, exige interseção com `qualifPorContato[c.id]`; `filtroQualifs` entra no array de dependências.
- Usa `qualificacoes` e `qualifPorContato`, já carregados na página — nenhuma consulta nova, nenhuma tabela, cron, realtime ou edge function. Custo de backend inalterado.
