# Reaquecimento dos números YELLOW/RED: por que travou e como corrigir

## Situação real (verificada agora no banco)

Hoje existem **11 números seus da API oficial fora do verde**: 9 em RED e 2 em YELLOW.
Desses, apenas **2 estão realmente sendo reaquecidos** (SOUZA 62 8269-3467 e 62 8269-9531). Os outros 9 estão em RED/YELLOW com o reaquecimento **desligado**, sem receber nenhum envio.

Efeito prático no volume de reaquecimento:
- 03/09: 160 mensagens de reaquecimento
- 04/09 (até agora): **9 mensagens**, todas de um único número

Causa: o reaquecimento só liga no **instante em que a qualidade cai** (na hora em que o sistema vê a mudança de GREEN → YELLOW/RED). Quem já estava em RED antes disso, quem teve a leitura de qualidade falhando na hora da queda, ou quem saiu do reaquecimento por um erro da Meta (os bloqueios #131031/#131042 de ontem) e depois foi liberado, **nunca volta a entrar sozinho**. O motor de reaquecimento só olha os números marcados, então esses 9 ficam parados indefinidamente.

Sobre os relatórios: existe um resumo de reaquecimento às 13h e 18h, mas ele (a) só vai para **um** número (62991672674) e (b) **não envia nada** quando não há ninguém marcado em reaquecimento — ou seja, exatamente na situação de hoje, em que 9 números estão em RED sem tratamento, você não recebe aviso nenhum. O último resumo saiu ontem às 18h.

## O que vou fazer

1. **Varredura de recuperação (o conserto principal):** em cada checagem de saúde (de hora em hora), todo número próprio em YELLOW ou RED que não estiver em reaquecimento entra automaticamente, mesmo sem ter havido uma queda naquele momento. Deixa de depender do "momento exato da queda".
2. **Voltar sozinho depois de bloqueio resolvido:** quando a Meta recusa o envio e o reaquecimento é pausado, ao número ser liberado ele volta ao reaquecimento na checagem seguinte em vez de ficar parado.
3. **Ligar os 9 números agora**, sem esperar a próxima checagem, e disparar uma rodada imediata para o dia não ficar zerado.
4. **Relatório para os dois WhatsApps** (62991672674 e 62994300880), às 13h e 18h, com por número: qualidade atual, enviadas/meta do dia, respostas recebidas, falhas, dias em GREEN e previsão de volta ao verde.
5. **Relatório também quando algo está errado:** se não houver ninguém em reaquecimento, o resumo passa a avisar isso (com a lista de números em YELLOW/RED sem tratamento, se houver) em vez de simplesmente não ser enviado.
6. **Aviso de entrada:** quando um número entra no reaquecimento pela varredura, você recebe a mesma notificação de início que já existe.

## Detalhes técnicos

- `check-meta-instance-health/index.ts`: além do gatilho `caiu` (linha ~251), acrescentar um caminho "reconciliação": se `qual` ∈ {YELLOW, RED}, `recuperacao_ativa !== true`, `qualidade_liberada_manual !== true`, `aquecimento_qualidade_permitido !== false` e `cfg.recuperacao_auto !== false`, então setar `recuperacao_ativa = true`, `recuperacao_desde` (se vazio), `recuperacao_msgs_meta_dia` sorteado entre `recuperacao_msgs_min_dia`/`max_dia` e `recuperacao_proximo_envio_em = now()`, sem reiniciar a quarentena já existente. Notificar via `notificar-admin` com `chaveIdempotencia` diária por instância.
- `meta-recuperacao-relatorio/index.ts`: substituir o `skipped: 'nenhuma_em_recuperacao'` por uma mensagem de alerta que lista os YELLOW/RED com `recuperacao_ativa=false`; passar `destinos: ['5562991672674','5562994300880']` no `notificarAdmin`.
- Correção pontual de dados (`run_sql`): ligar `recuperacao_ativa` nos 9 números YELLOW/RED atuais e chamar `meta-recuperacao-tick` com `forcar` para uma rodada imediata.
- Sem tabela nova, sem cron novo, sem polling — os crons de saúde (1h) e de relatório (13h/18h) já existem. **Sem impacto de custo no Lovable Cloud.**
