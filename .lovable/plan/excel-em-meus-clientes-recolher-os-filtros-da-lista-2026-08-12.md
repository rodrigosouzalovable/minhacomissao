# Excel em "Meus Clientes" + recolher os filtros da lista

## 1. Botão "Baixar Excel" no modo Meus Clientes

- Aparece dentro do painel "Meus Clientes" (junto aos filtros de data e marcadores), só quando o modo está ativo.
- Exporta exatamente a lista que está sendo exibida (respeitando período, marcadores e busca).
- Colunas: Telefone, Nome, Marcador (qualificação), Última mensagem em, Caixa de mensagens.
- Enquanto baixa, o botão mostra "Baixando..." e ao final um aviso com o total de linhas exportadas.
- Nome do arquivo: `meus-clientes-AAAA-MM-DD`.

## 2. Minimizar / maximizar os filtros da barra lateral

- Novo botão de recolher (seta para cima/baixo) no topo do bloco de filtros da lista de conversas.
- Ao minimizar, ficam escondidos: abas Conversas/Arquivados, Todas/Não lidas, o botão Meus Clientes com seus filtros e a faixa de caixas de mensagens (Padrão, AMARAL, AQUECIMENTO...).
- Permanecem sempre visíveis: a busca por nome/telefone e os botões de etiqueta e janela 24h — assim a lista de conversas ganha bastante altura.
- Quando algum filtro estiver ativo (Meus Clientes, etiqueta, não lidas, janela 24h), o botão recolhido mostra um indicador para o usuário não se perder.
- A escolha (minimizado ou não) é lembrada no navegador do usuário.

## Detalhes técnicos

- `src/pages/InboxMeta.tsx`:
  - novo estado `filtrosRecolhidos` persistido em `localStorage` (`inbox-meta-filtros-recolhidos`); envolve os blocos de tabs, leitura, Meus Clientes e caixas em render condicional.
  - novo botão de download usando `exportarParaExcel` de `src/lib/exportExcel.ts` sobre `contatosFiltrados`, resolvendo nome via `nomesCRM` e marcador via `qualifPorContato` + lista `qualificacoes`; sem novas consultas ao banco (dados já carregados na tela).
  - se a lista visível estiver paginada pelo "carregar mais", a exportação usa os contatos já carregados; nenhum novo tráfego é gerado.
- Sem mudanças de banco, cron, Realtime ou regras de envio — custo inalterado.
