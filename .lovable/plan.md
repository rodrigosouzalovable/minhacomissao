## Objetivo

Transformar o botão "🟢 Janela 24h" (ícone Clock, ao lado do filtro de etiquetas no Inbox Meta) num **filtro inline** da própria lista de conversas, em vez de abrir o dialog `Janela24hDialog`.

## Comportamento

- **Clique no botão** → alterna um estado `filtroJanela24h` (on/off).
- **Quando ativo**:
  - A lista de conversas passa a mostrar **apenas** contatos cuja bolinha da janela está **verde (aberta)** ou **amarela (alerta)**, ou seja, `computeJanela(c.ultima_msg_entrada_em).status !== 'fechada'` (e há `ultima_msg_entrada_em` válida).
  - Botão fica destacado (variant `default` / cor primary) para indicar filtro ativo.
- **Clique novamente** → desativa o filtro e volta a mostrar todas as conversas.
- O dialog `Janela24hDialog` **não abre mais** a partir desse botão.

## Arquivos alterados

### `src/pages/InboxMeta.tsx`
1. Remover `useState` `janela24hOpen` e o import de `Janela24hDialog`, remover a renderização `<Janela24hDialog ... />` no final do JSX.
2. Adicionar `const [filtroJanela24h, setFiltroJanela24h] = useState(false);`.
3. Alterar o `onClick` do botão (linha ~885) para `setFiltroJanela24h(v => !v)`; aplicar `variant={filtroJanela24h ? 'default' : 'outline'}` e ajustar `title` para "Filtrar conversas com janela 24h ativa (verde/amarela)".
4. No `useMemo` `contatosFiltrados` (linha 513), adicionar etapa final: se `filtroJanela24h`, filtrar por `computeJanela(c.ultima_msg_entrada_em).status === 'aberta' || 'alerta'`.

Nenhuma outra tela é afetada. O componente `Janela24hDialog` continua existindo no repo (não removo o arquivo), apenas deixa de ser usado aqui.
