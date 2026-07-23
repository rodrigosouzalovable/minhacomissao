
## Diagnóstico

A LD02 recebeu **Rate limit exceeded (código 80007)** da Meta com `Retry-After: ~36s`. Não é banimento — é o teto de throughput do tier atual do número. Como o job só tem 1 instância selecionada, quando ela pausou o job travou (32 enviadas · 29 erros · 640 pendentes).

Os 29 erros já são os mesmos contatos que foram devolvidos à fila (aparecem no botão "Tentar novamente (29)"). Não perdemos ninguém.

## Ação imediata (destravar essa campanha)

1. Confirmar via SQL o estado do job e da instância LD02 (`pausa_automatica_ate`, `estado_pool`, `msgs_por_segundo` do job).
2. Se ainda houver pausa vigente, aguardar/limpá-la; forçar `msgs_por_segundo = 1` no job.
3. Reativar o job (`envio-meta-massa-control` → `reativar`) — ele já dispara o burst worker para a LD02.
4. Rodar `envio-meta-massa-retry-erros` para devolver os 29 erros à fila da própria LD02 (a redistribuição não vai encontrar outra instância elegível, então mantém na LD02 mesmo — que é o desejado).
5. Deixar o worker escoar os 669 restantes a 1 msg/s (~11 min).

## Prevenção — cap adaptativo por instância no Modo Rajada

Objetivo: cada instância descobre sozinha seu teto sem travar o job inteiro.

**Modelo de controle (por instância, dentro do burst worker):**

```text
inicio:            msgs_por_segundo = 1
a cada 60s sem erro de rate-limit: msgs_por_segundo = min(cap_slider, atual + 1)
ao receber 80007 (rate limit):     msgs_por_segundo = max(1, floor(atual / 2))
                                   respeita "Retry-After" do header/erro
ao receber 131056 (pair rate):     mesma lógica de corte
```

Estado por instância vive em memória do worker + persistido em `meta_whatsapp_instances` (colunas novas ou reuso de campos existentes: `rajada_taxa_atual`, `rajada_ultima_reducao_em`). O slider global vira **teto máximo**, não valor fixo.

**Mudanças de código:**

- `supabase/functions/envio-meta-massa-burst/index.ts`: substituir o token-bucket global do job pelo bucket **por instância**, lendo `rajada_taxa_atual`. Ao receber 80007, além de pausar até `Retry-After`, gravar nova taxa reduzida. Ao completar N envios consecutivos sem 80007, subir a taxa de volta em 1.
- `supabase/functions/send-whatsapp-meta/index.ts` (ou onde 80007 é tratado): garantir que o retorno inclua `retry_after_ms` e `rate_limited: true` para o worker consumir.
- Migração: adicionar `rajada_taxa_atual smallint default 1`, `rajada_ultimo_ajuste_em timestamptz` em `meta_whatsapp_instances` (+ GRANTs padrão).
- `src/pages/EnvioMeta.tsx`: renomear o slider para "Velocidade máxima por instância (msg/s)" e adicionar tooltip explicando que o sistema pode enviar mais devagar se a Meta pedir.
- `src/components/meta/CampanhaDetalheDialog.tsx`: exibir, ao lado de cada instância, a **taxa atual** (ex.: "LD02 · 1 msg/s · pausada até 13:13:11") lendo `rajada_taxa_atual` / `pausa_automatica_ate`.

## Observações

- Não altero a lógica de banimento (BANNED/FLAGGED continua tirando a instância do job).
- Rate-limit deixa de ser evento crítico visível — vira só um ponto no gráfico da taxa da instância.
- Nada muda fora do Modo Rajada.

## Passos de execução

1. SQL: inspecionar `envio_meta_job`, `envio_meta_job_item` (erros/pendentes), `meta_whatsapp_instances` da LD02.
2. Migração das colunas novas + GRANTs.
3. Editar `envio-meta-massa-burst` com bucket por instância + AIMD (aumenta +1/min, corta pela metade em rate-limit).
4. Ajustar retorno do sender para expor `retry_after_ms`.
5. Ajustar UI (`EnvioMeta.tsx`, `CampanhaDetalheDialog.tsx`).
6. Destravar a campanha atual: `msgs_por_segundo=1`, `rajada_taxa_atual=1` na LD02, chamar `envio-meta-massa-control` reativar + `envio-meta-massa-retry-erros`.
7. Validar: acompanhar contadores subirem em ritmo constante de ~1/s sem novos 80007.
