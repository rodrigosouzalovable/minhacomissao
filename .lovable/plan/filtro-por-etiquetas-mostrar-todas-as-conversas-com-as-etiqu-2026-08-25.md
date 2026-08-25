# Filtro por etiquetas: mostrar todas as conversas com as etiquetas selecionadas

## O que acontece hoje

O filtro de etiquetas já funciona, mas ele só filtra a lista de conversas **já carregada na tela** (o lote atual da caixa, ordenado pela última mensagem). Conversas mais antigas que têm a etiqueta selecionada não aparecem, porque nunca foram carregadas — dá a impressão de que o filtro "não pega tudo".

## O que será feito

- Ao selecionar uma ou mais etiquetas, a lista passa a ser montada **direto no banco**: busca os contatos vinculados àquelas etiquetas e mostra somente eles.
- O resultado cobre todo o histórico da caixa atual (não só o lote visível), ordenado pela última mensagem.
- Continua respeitando os filtros que já existem: caixa de mensagens, aba Conversas/Arquivados, instância, busca por nome/telefone, Todas/Não lidas, janela 24h e qualificações.
- Selecionar várias etiquetas mostra conversas que tenham **pelo menos uma** delas (comportamento atual).
- Ao limpar as etiquetas, a lista volta ao comportamento normal paginado.
- O modo "Meus Clientes" segue como está hoje.

## Detalhes técnicos

- Arquivo: `src/pages/InboxMeta.tsx`.
- Em `fetchContatos`, novo ramo quando `filtroEtiqueta.size > 0` (após o ramo `modoMeusClientes`): busca em `meta_whatsapp_contato_etiquetas` os `contato_id` com `etiqueta_id in (selecionadas)` (paginado em blocos de 1000), deduplica e busca `meta_whatsapp_contatos` por `id in (...)` em lotes de 200, aplicando `arquivado = abaAtiva === 'arquivados'`, `folder_id` da caixa atual e `filtroInstancia`, ordenado por `ultima_mensagem_em desc`, cortado em `limiteContatos`; depois `fetchContatoEtiquetas` / `fetchQualifContatos` sobre os IDs retornados.
- Incluir `filtroEtiqueta` nas dependências do `useCallback` de `fetchContatos`.
- Manter o filtro cliente-side em `contatosFiltrados` (linhas ~1033-1036) como segunda camada, para o realtime de etiquetas refletir na hora.
- Sem novas tabelas, cron, realtime ou edge function; consultas só acontecem quando o filtro é usado. Custo de backend praticamente inalterado.
