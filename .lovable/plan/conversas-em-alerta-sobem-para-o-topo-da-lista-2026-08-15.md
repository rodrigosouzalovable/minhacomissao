# Conversas em alerta sobem para o topo da lista

## Comportamento

Na lista de conversas do Inbox Meta Oficial, a ordem passa a ser:

1. Conversas fixadas (como já é hoje)
2. Conversas **vermelhas** (30+ min sem resposta) — mais antigas primeiro
3. Conversas **amarelas** (15 a 30 min sem resposta) — mais antigas primeiro
4. Demais conversas, pela última mensagem (comportamento atual)

Detalhes:
- Dentro de cada grupo de alerta, quem está esperando há mais tempo aparece acima, para o atendente atacar o caso mais crítico primeiro.
- Assim que o atendente responde (ou marca "não precisa resposta"), a conversa perde a cor e volta para a posição normal por data.
- A reordenação acompanha o mesmo relógio já usado hoje pelas cores (revalidação a cada 30s), então card colorido e posição na lista nunca ficam divergentes.
- Filtros, busca, "Meus Clientes" e janela 24h continuam funcionando igual — a mudança é só de ordenação.

## Detalhes técnicos

- `src/pages/InboxMeta.tsx`: no `useMemo` de `contatosFiltrados` (ordenação atual só por `fixado` + `ultima_mensagem_em`), adicionar um nível de rank de SLA calculado inline com a mesma regra do card (`ultima_msg_entrada_em` vs `ultima_mensagem_em` vs `sla_dispensado_em`, limites 15/30 min) usando o `nowTick` existente. A função `computeEspera` é declarada depois desse memo, então a regra é replicada inline em um helper puro para evitar problema de ordem de declaração.
- Adicionar `nowTick` às dependências do memo para reordenar junto com o piscar dos cards.
- Sem alteração de banco, sem novas consultas, sem novo canal Realtime: custo Lovable Cloud inalterado.
