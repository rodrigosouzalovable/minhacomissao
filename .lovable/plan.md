# Diagnóstico e correção da coleta 3C Plus

## O que eu verifiquei agora

- **O token está válido.** Chamei a integração com ação "testar" e a 3C respondeu 200 listando as campanhas ("Campanha Padrão" e "Discador Souza e Ribeiro"). **Não é necessário atualizar o token do gestor.**
- **A coleta automática nunca concluiu.** Na configuração, o campo de último sync está vazio (`ultimo_sync = null`), ou seja, nenhuma execução de sincronização terminou com sucesso até hoje.
- **Ao rodar a coleta manualmente do dia 06/08, a requisição foi cancelada por tempo** (a função busca até 40 páginas de 500 ligações em sequência e, no final, ainda dispara o recálculo do relatório na mesma requisição — estoura o limite de execução).
- **O webhook da 3C parou em 05/08 às 16:15 BRT** (último evento registrado: `call-history-was-created`). Todas as 995 ligações gravadas são do dia 05/08. Depois disso, nada entrou nem por webhook nem por coleta.

Resumo: a integração está autenticada, mas ficou sem nenhuma via de entrada de dados — o webhook silenciou e a coleta de segurança nunca chegou ao fim.

## O que fazer

1. **Tornar a coleta resiliente (causa principal)**
   - Paginar com limite de tempo: parar a busca e salvar o que já veio antes de estourar o tempo de execução, retomando a partir da página seguinte na próxima chamada.
   - Gravar em lotes assim que cada página chega (em vez de acumular tudo em memória) e atualizar o último sync a cada lote gravado.
   - Desacoplar o recálculo do relatório: disparar em segundo plano, sem bloquear a resposta.
   - Registrar no log quantas ligações vieram por dia/página, para que falhas fiquem visíveis.

2. **Fazer a recuperação do período perdido**
   - Rodar a coleta para 06/08 e 07/08 depois do ajuste, confirmando quantas ligações a 3C realmente tem nesses dias.
   - Se a 3C não tiver registros nesses dias, o problema é do lado do discador (campanha parada) e isso será reportado claramente, com o número exato retornado pela API.

3. **Reativar e monitorar o webhook**
   - Confirmar a URL e a chave de webhook atuais na tela de configuração da 3C+ e reinscrever no painel do discador.
   - O aviso de "coleta 3C sem dados" já existe na tela de Relatórios; vou incluir também o horário do último webhook recebido, para diferenciar "webhook caiu" de "não houve ligações".

4. **Ajustar o horário do cron de segurança**
   - Hoje ele roda de hora em hora entre 11h e 22h UTC (08h–19h BRT) — correto, mas foi criado hoje e ainda não executou nenhuma vez. Depois da correção, farei uma execução manual para validar de imediato, sem esperar a próxima hora.

## Detalhes técnicos

- `supabase/functions/relatorio-3c-sync/index.ts`: paginação com orçamento de tempo (~50s), upsert incremental por página em `tresc_ligacoes` (`onConflict: call_id`), atualização de `tresc_config.ultimo_sync` por lote, e chamada ao `relatorio-acionamentos-sync` via `EdgeRuntime.waitUntil`, com suporte a `page_inicial`/`max_paginas` no body para backfill controlado.
- `src/components/relatorios/Config3CPlusDialog.tsx` e `src/pages/Relatorios.tsx`: exibir `ultimo_webhook_em` e `ultimo_sync` lado a lado, com o aviso distinguindo webhook parado de ausência de ligações.
- Sem mudança de schema.
