## Diagnóstico
Testei diretamente a Graph API da Meta com o token de uma das instâncias e descobri a causa: a edge function `meta-billing-sync` usa o campo `conversation_analytics` na v21.0. Esse endpoint foi **descontinuado** — hoje ele responde `{"id":"..."}` vazio (sem `data_points`), por isso o banco `meta_billing_snapshot` está zerado e o dialog fica em branco.

O substituto correto é `pricing_analytics` na v24.0, que retorna volume de mensagens cobradas por dia, categoria e tipo. Testei e voltou dados reais:

```
pricing_category=SERVICE  pricing_type=FREE_CUSTOMER_SERVICE  volume=131  (grátis)
pricing_category=UTILITY  pricing_type=REGULAR                volume=56   (cobrado)
pricing_category=UTILITY  pricing_type=FREE_CUSTOMER_SERVICE  volume=1    (grátis)
```

## Correção

Ajustar **apenas** `supabase/functions/meta-billing-sync/index.ts`:

1. Trocar versão da Graph API para `v24.0`.
2. Trocar o campo de `conversation_analytics(...)` por:
   ```
   pricing_analytics.start(START).end(END).granularity(DAILY)
     .dimensions(["PRICING_CATEGORY","PRICING_TYPE","COUNTRY"])
   ```
3. Ler `pricing_analytics.data[0].data_points`.
4. Mapear cada ponto para `meta_billing_snapshot`:
   - `conversation_category` ← `pricing_category`
   - `conversation_type` ← `pricing_type`
   - `conversations_count` ← `volume`
   - `dia` ← `new Date(start*1000).toISOString().slice(0,10)`
   - `cost_usd`: `0` quando `pricing_type = FREE_CUSTOMER_SERVICE`, caso contrário `volume * PRECO_USD[pricing_category]`
   - `cost_brl`: `cost_usd * fx_rate`
5. Manter a chave de upsert atual `(waba_id, dia, conversation_category, conversation_type)`.

## Efeito no frontend
Nenhuma mudança de código. Após rodar "Sincronizar com Meta" no dialog, ele vai popular as três abas automaticamente (o dialog já consome `meta_billing_snapshot` e `meta_whatsapp_envios_log`).

## Fora de escopo
- Sem alterações no dialog, no webhook, nas tabelas, em migrations, em client.ts/types.ts/.env/config.toml.
- Sem novos endpoints, sem cron novo.

⚠️ **ALERTA DE CUSTO ALTO LOVABLE CLOUD**: impacto zero. Só corrige uma chamada externa que já existia (para a API da Meta, não Lovable Cloud). Nenhum novo cron, polling, realtime, tabela ou índice.

## Arquivo afetado
- `supabase/functions/meta-billing-sync/index.ts`
