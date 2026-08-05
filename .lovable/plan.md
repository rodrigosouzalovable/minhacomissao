# Corrigir Relatórios: acionamentos truncados e ligações da 3C Plus sem gravar

Investiguei os dados reais de hoje (05/08) e encontrei **dois problemas independentes**, os dois confirmados.

## Problema 1 — Acionamentos parados/incompletos (689 em vez de ~1.745)

A rotina que alimenta o relatório busca as mensagens do dia em uma única consulta. O resultado vem **cortado** pelo limite de linhas da API, então só uma parte das mensagens é contada — e as horas cujas linhas não vieram no corte ficam **zeradas**.

Comprovação (dados reais de hoje, envios por hora):

| Hora | Real no banco | No relatório |
|---|---|---|
| 8h-9h | 297 | 261 |
| 9h-10h | 347 | **0** |
| 10h-11h | 194 | **0** |
| 11h-12h | 147 | **0** |
| 12h-13h | 176 | **0** |
| 13h-14h | 196 | 56 |
| 14h-15h | 320 | 326 |
| 15h-16h | 68 | 46 |

Total real de clientes acionados hoje: **1.745** (2.195 mensagens de saída). O relatório mostra 689.

### Correção

1. Ler as mensagens do dia **paginando** (blocos de 1.000, com ordenação estável) até o fim, em vez de uma consulta única. Mesmo tratamento para acordos e para o cache de ligações.
2. **TENTATIVAS e WHATSAPP passam a contar cada disparo**, não apenas o primeiro contato do dia por telefone. É isso que faz o número bater com as suas campanhas (763 + 684 enviados = disparos reais). CPC e CPC-A continuam contando **um telefone uma vez por dia**, como hoje.
3. Recalcular o dia inteiro (05/08) logo após a correção, e reprocessar os últimos dias para que o histórico fique correto.

## Problema 2 — Discador 3C Plus não aparece

O webhook **está chegando** (recebido às 14:59 de hoje), mas todo evento é descartado. O motivo: a 3C envia o pacote em um formato diferente do esperado —

```text
{ "call-history-was-created": { "callHistory": { "_id": "...", "campaign": {...}, ... } } }
```

O nome do evento é a **própria chave** do objeto, e a ligação vem dentro de `callHistory` com o identificador em `_id`. Nosso código procura `call`/`data` e `id`, não encontra, grava "desconhecido (ignorado)" e sai. Por isso a tabela de ligações está com **0 registros** e as colunas ALÔ/CPC de ligação ficam zeradas.

### Correção

1. Aceitar o formato real: detectar o evento pela chave raiz (`call-was-connected`, `call-history-was-created`), e o objeto da ligação em `callHistory` / `call` / `data` / raiz.
2. Aceitar `_id` como identificador e buscar o telefone nos campos que a 3C usa (`phone`, `number`, `telephone`, `dialed_number`, `contact.phone`).
3. Usar `call_date` / `call_timestamp` para definir dia e faixa de hora em BRT; marcar **ALÔ** por tempo falado com agente / `answered_time`.
4. Registrar no `tresc_config` o último evento recebido com o nome correto, para o selo do painel deixar de dizer "ignorado".
5. Após o ajuste, confirmar nos logs que os próximos eventos gravam ligação de verdade (a 3C está discando agora, então a validação é imediata).

Observação: as 23 qualificações já estão importadas. Enquanto nenhuma delas estiver marcada como CPC/CPC-A no painel "3C Plus", as ligações aparecerão em TENTATIVAS e ALÔ, mas não em CPC — o mapeamento é feito por você naquele diálogo.

## Detalhes técnicos

- `supabase/functions/relatorio-acionamentos-sync/index.ts`: helper de paginação por `range()` com `order` estável para `meta_whatsapp_mensagens`, `acordos` e `tresc_ligacoes`; contagem de WhatsApp/tentativas por volume de mensagens de saída (mantendo `*_manual` intocado — edição do admin nunca é sobrescrita).
- `supabase/functions/tresc-webhook/index.ts`: extração tolerante de envelope/evento/`_id`/telefone, conforme o payload real capturado nos logs; upsert idempotente por `call_id` mantido.
- `supabase/functions/relatorio-3c-sync/index.ts`: mesma normalização de payload/paginação para a sincronização de segurança.
- Sem novas tabelas, sem novo cron, sem novo canal Realtime — **nenhum aumento de custo no Lovable Cloud**; a paginação apenas divide a mesma leitura em blocos.
