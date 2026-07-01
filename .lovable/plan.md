## Objetivo

Na aba **Inbox Meta Oficial**, adicionar um filtro de visualização estilo WhatsApp com dois botões: **Todas** e **Não lidas**. Também corrigir o comportamento em que, ao abrir uma conversa com mensagens não lidas, ela "pula" para o fim da lista.

## Mudanças

Arquivo único: `src/pages/InboxMeta.tsx`

### 1. Novo filtro "Todas / Não lidas"

- Adicionar estado `filtroLeitura: 'todas' | 'nao_lidas'` (default `'todas'`).
- Adicionar dois botões-pílula na barra de filtros (próximo aos botões "Conversas / Arquivados" existentes), no mesmo estilo visual.
  - **Todas** → mostra todas as conversas da aba atual.
  - **Não lidas** → filtra apenas `c.nao_lido > 0`.
- O filtro é aplicado dentro do `contatosFiltrados` (memo já existente).

### 2. Corrigir "salto" da conversa ao abrir mensagens não lidas

Hoje a ordenação usa:
```
rank = (fixado ? 0 : 10) + (nao_lido > 0 ? 0 : 1)
```
Isso empurra conversas não lidas para o topo. Quando o usuário abre uma conversa não lida, `nao_lido` vira 0 e o rank sobe de 10 para 11 → a conversa "cai" para baixo da lista.

Correção: remover o componente `nao_lido` do rank. A ordenação passa a ser:
- Fixadas primeiro.
- Depois por `ultima_mensagem_em` desc (mais recente no topo — comportamento igual ao WhatsApp comum).

Assim, ler uma conversa não altera sua posição. Conversas não lidas continuam visualmente destacadas (negrito + badge verde, já existente).

### 3. Sem mudanças em backend

Nenhuma alteração de schema, RLS, Edge Function ou realtime. É só UI + lógica de ordenação/filtro no cliente.

## Resultado esperado

- Dois botões "Todas" / "Não lidas" acima da lista de conversas.
- "Todas": lista estável ordenada por data (fixadas no topo). Abrir uma conversa não muda a ordem.
- "Não lidas": mostra somente conversas com badge verde; ao abrir uma delas ela some do filtro (esperado, pois foi marcada como lida) mas isso não afeta a aba "Todas".
