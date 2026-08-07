# Deixar o Inbox Meta Oficial e o sino de CPF rápidos

## O que está causando a lentidão (verificado)

1. **A lista de conversas carrega 2.000 conversas de uma vez.** Hoje existem 7.689 conversas ativas, e **6.516 delas nunca receberam resposta do cliente** — ou seja, a maior parte do peso da tela é lixo operacional.
2. **Qualquer alteração em qualquer conversa recarrega a lista inteira.** O canal em tempo real escuta a tabela toda e, a cada evento (inclusive durante disparos em massa), refaz a busca das 2.000 linhas. Sem agrupamento de eventos, e ainda há uma releitura a cada 60 s.
3. **As etiquetas são lidas por varredura completa da tabela** (paginação de 1.000 em 1.000, 1.485 vínculos) a cada abertura da tela e a cada vez que a aba volta ao foco.
4. **O sino de CPF entra em ciclo de recarga.** A função de busca depende do mapa de nomes que ela própria preenche, então o efeito se refaz e reinscreve o canal em tempo real repetidamente. Além disso, o painel de estatísticas baixa até 5.000 registros só para contar consultas por dia (existem 1.658 no total).
5. A retenção atual só arquiva conversas sem resposta depois de **3 dias**, uma vez por dia às 03:00 BRT.

## O que vai mudar

**1. Retenção em 24h (como você pediu)**
- Conversas **abertas por nós e sem nenhuma resposta do cliente** saem da lista após **24h** do último envio.
- Elas não são destruídas: ficam fora da visão principal e **reaparecem automaticamente na hora em que o cliente responde** (o webhook já desarquiva).
- Continuam protegidas: qualquer conversa com resposta do cliente, fixada, com não lidas ou com etiqueta aplicada **nunca** é tocada.
- A limpeza passa a rodar de hora em hora, em lotes, em vez de uma vez por dia.

**2. Lista de conversas mais leve**
- Passar de 2.000 para um lote inicial de 300 conversas, com "carregar mais" ao rolar.
- Buscar apenas as colunas usadas no card da conversa.
- Agrupar os eventos em tempo real (uma atualização a cada ~1,5 s no máximo) e restringir a escuta à caixa/instância que está aberta, em vez da tabela toda.
- Trocar a releitura de 60 s por atualização apenas quando houver evento ou quando a aba volta ao foco.

**3. Etiquetas sem varredura completa**
- Buscar os vínculos de etiqueta **somente dos contatos exibidos na tela**, em vez de toda a tabela.
- Manter a aplicação incremental dos eventos em tempo real (já existe) e a reconciliação no retorno ao foco, agora limitada aos contatos visíveis.

**4. Sino de CPF**
- Corrigir o ciclo de recarga: o mapa de nomes dos atendentes deixa de fazer parte da dependência da busca, e o canal em tempo real passa a ser criado uma única vez.
- Trocar o download dos registros dos últimos 7 dias por uma contagem agregada no banco (uma função que devolve total por dia), eliminando a leitura em massa.
- Carregar a lista e as estatísticas **somente quando o sino é aberto**, com cache curto; o número do badge vem de uma contagem leve.
- A exportação em Excel continua trazendo tudo, sem alteração.

## Detalhes técnicos

- `supabase/functions/meta-inbox-retention/index.ts`: corte de 3 dias → 24h; processamento em lotes; nova entrada de cron horária (substitui `meta-inbox-retention-daily`).
- `src/pages/InboxMeta.tsx`: `limit(2000)` → paginação de 300; `fetchContatoEtiquetas` filtrado por `contato_id in (visíveis)`; debounce no handler do canal `meta-inbox-contatos`; remoção do polling de 60 s.
- `src/components/inbox/meta/NotificacoesCpfBell.tsx`: `fetchNotificacoes` sem dependência de `nomesUsuarios` (usar ref), efeito de canal com dependências estáveis, busca sob demanda ao abrir o popover.
- Banco: uma função `SECURITY DEFINER` de contagem diária de consultas de CPF (respeita a regra atual — admin vê tudo, demais veem apenas as próprias) + `GRANT EXECUTE` para autenticados. Nenhum dado é apagado.
- Índices: os necessários já existem (`idx_meta_wa_contatos_arq_ult`, `idx_meta_wa_contatos_folder`, `idx_consulta_cpf_notif_user_created`).

## Custo Lovable Cloud

Este plano **reduz** consumo: menos linhas lidas por carregamento, menos refetches, um polling removido e a retenção mantendo a tabela de conversas ativas pequena. O único aumento é a frequência da retenção (1x/dia → 1x/hora), que é uma execução curta e barata — e ela é justamente o que evita o acúmulo de 6.500 conversas mortas.
