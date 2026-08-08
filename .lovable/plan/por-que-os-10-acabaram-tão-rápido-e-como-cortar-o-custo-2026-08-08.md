# Por que os $10 acabaram tão rápido — e como cortar o custo

## O que eu verifiquei agora (dados reais do seu backend)

1. **O tamanho da instância está em "Large".** Esse é de longe o maior item da conta: o Cloud cobra por hora de máquina ligada, 24h por dia, independente de uso. E a máquina está folgada: memória em 25%, conexões 40 de 160, disco 24%. Ou seja: você paga por uma máquina grande que não está sendo usada nem perto do limite.

2. **Um agendamento roda a cada 10 segundos, o dia inteiro.** O job `envio-meta-massa-tick` executou **8.619 vezes nas últimas 24h**, mesmo sem campanha em andamento. Isso mantém a máquina sempre ocupada (nunca entra em pausa por inatividade) e gera milhares de chamadas de função + consultas ao banco por dia.

3. **Consultas repetidas e pesadas estão consumindo CPU.** As mais caras acumuladas:
   - `envio_meta_job_item` — 651 mil chamadas, média de 596 ms cada
   - `meta_whatsapp_envios_log` — 1,14 milhão de chamadas, média 255 ms
   - `whatsapp_contatos` — 665 mil chamadas, média 262 ms
   - `pagamentos` — 302 mil chamadas, média 495 ms, sem filtro (varre a tabela toda)

4. **4,48 milhões de transações revertidas** desde o último boot — sinal de chamadas que falham/repetem em loop, queimando CPU sem entregar nada.

## Plano de correção (em ordem de impacto)

### 1. Reduzir o tamanho da instância (maior economia, imediata)
Baixar de **Large** para **Medium** (ou **Small**, dado o uso atual). Com 25% de memória e 40/160 conexões, há folga de sobra. Isso corta a maior parte do gasto diário por hora de máquina. Feito com aprovação sua, direto no chat.

### 2. Fazer o tick de 10s só rodar quando existe campanha
Hoje o job chama a função a cada 10s sempre. Mudança: o agendamento passa a checar primeiro no banco se existe job de envio com status ativo; se não existir, não chama nada. Sem campanha rodando = zero invocação. Isso remove a maior parte das 8.619 execuções/dia sem mudar em nada a velocidade do disparo quando você está enviando.

### 3. Índices nas consultas mais caras
Criar índices direcionados para os 4 padrões acima (`envio_meta_job_item` por job+status+processado_em, `meta_whatsapp_envios_log` por user+enviado_em, `whatsapp_contatos` por instância+arquivado+última mensagem, `pagamentos` por acordo/data). Confirmo o plano de execução com EXPLAIN antes e depois de cada índice.

### 4. Cortar o excesso de polling no app
- A consulta em `pagamentos` sem filtro: passar a buscar só os acordos da tela (ou usar o resumo agregado já existente) em vez de varrer a tabela.
- Painéis de envio/monitor que recarregam a cada 5s: subir o intervalo enquanto não há envio ativo e manter o guard de aba visível.

### 5. Investigar as transações revertidas
Rastrear nos logs qual chamada está falhando em loop (provável candidato: retry de envio ou webhook) e corrigir a causa, para não pagar CPU por trabalho descartado.

## Observação sobre a fatura
Reduzir a instância e desligar o tick ociosa afeta o custo **a partir do momento em que aplicamos** — não recupera o que já foi consumido. Os $25 gratuitos do mês renovam em 1 Sep 2026.

## Detalhes técnicos
- Instância: Large → Medium/Small via resize (requer sua aprovação).
- Cron `envio-meta-massa-tick-10s` (jobid 50): comando passa a ser condicional (`IF EXISTS (select 1 from envio_meta_job where status in (...)) THEN net.http_post(...)`), mantendo o schedule de 10s.
- Índices via migração normal (`CREATE INDEX`, não CONCURRENTLY).
- Nenhuma regra de negócio de envio, IAGO, lembretes ou relatórios é alterada.
