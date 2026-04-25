
# Relatório Diário Avançado no WhatsApp (20h BRT)

Vou criar uma nova rotina automática que, todo dia às **20:00 BRT**, monta um relatório completo do sistema de aquecimento e envia para o seu WhatsApp pessoal **(62) 99167-2674**, com fallback automático entre as instâncias conectadas caso alguma falhe.

> Importante: já existe a função `daily-report-aquecimento` (resumo curto). Esta nova função é **separada** (`daily-report-advanced`), com 7 seções detalhadas, IA e fallback. As duas vão coexistir — a antiga continua funcionando como está.

---

## O que o relatório vai conter

1. **Visão geral** — total de instâncias, em aquecimento, aquecidas (Fase 5), pausadas, taxa de sucesso.
2. **Conversas IA do dia** — total de conversas, trocas, média e listagem par-a-par (até 20 mostradas, restante resumido).
3. **Auto-save** — total de envios, média por instância, **TOP 5** que mais enviaram e instâncias com **0 envios** (com motivo: pausada / fase baixa / sem contatos disponíveis).
4. **Distribuição por fase** + **próximas promoções** nos próximos 3 dias.
5. **Saúde das instâncias** — pausadas/desconectadas com motivo, recém-conectadas (últimos 3 dias), instâncias com taxa de falha > 10%.
6. **Sugestões da IA** — análise via Lovable AI Gateway (`google/gemini-2.5-flash`, gratuito durante o período promocional) interpretando os números do dia e dando recomendações práticas.
7. **Comparativo com o dia anterior** — variação % de conversas IA, auto-save e média de fases.

---

## Resiliência no envio

Vai seguir exatamente sua lógica:

1. Busca todas as instâncias com `status = 'connected'`.
2. Tenta enviar pela primeira; se falhar, tenta a próxima; assim por diante.
3. Se todas falharem, grava o relatório em `relatorios_diarios_enviados` com status `PENDENTE` para retentar no próximo ciclo.
4. Cada execução grava o resultado (sucesso/falha + qual instância foi usada) para histórico.

---

## Detalhes técnicos

### Nova tabela
`public.relatorios_diarios_enviados` (migration):
- `id uuid pk`, `data date unique`, `conteudo text`, `status text` (`ENVIADO|FALHOU|PENDENTE`), `instancia_utilizada_id uuid`, `tentativas int default 0`, `erro text`, `enviado_em timestamptz`, `criado_em timestamptz default now()`
- RLS: somente admins podem `SELECT` (service role insere/atualiza).

### Nova Edge Function
`supabase/functions/daily-report-advanced/index.ts` (`verify_jwt = false` em `supabase/config.toml`):
- Janela de 24h em BRT (00:00–23:59 do dia atual).
- Queries em paralelo: `whatsapp_aquecimento_instancias` + join `user_whatsapp_instances` (nome, status, conectado_em); `whatsapp_aquecimento_interacoes` (24h, agrupa por par origem/destino); `whatsapp_conversas_ia` (24h); `aquecimento_envios_autosave` (hoje + ontem para comparativo).
- Calcula TOP 5 auto-save, instâncias zeradas com motivo inferido (pausada / fase 1 sem ciclo / sem contatos).
- Calcula próximas promoções: `7 - dias_na_fase <= 3` e `fase < 5` e `fase_auto = true`.
- Detecta taxa de falha por instância usando `interacoes` com `status != 'ENVIADO'` vs total.
- Chama Lovable AI Gateway (`LOVABLE_API_KEY` já existe) com um resumo numérico compacto pedindo 3-5 sugestões em pt-BR.
- Monta a mensagem final formatada com emojis e separadores `━━━`.
- Loop de envio com fallback descrito acima usando os mesmos 3 endpoints UAZAPI já usados (`/send/text`, `/message/sendText`, `/sendText`).
- Grava em `relatorios_diarios_enviados` (upsert por `data`).
- Retorna JSON com status para invocação manual de teste.

### Cron job
Via SQL `cron.schedule` (não migration, pois inclui anon key) — todos os dias às **23:00 UTC** (20:00 BRT):
```
'daily-report-advanced-20h', '0 23 * * *',
net.http_post(url := '.../functions/v1/daily-report-advanced', headers := jsonb_build_object('Authorization', 'Bearer <ANON>', 'Content-Type', 'application/json'), body := '{}'::jsonb)
```

### Botão de teste manual (opcional, leve)
Adicionar no `AquecimentoDashboard.tsx` um pequeno botão "Enviar relatório agora" que chama `supabase.functions.invoke('daily-report-advanced')` para você testar sem esperar 20h.

---

## Custo na Lovable Cloud

- **+1 invocação por dia** da Edge Function (≈30/mês — desprezível).
- **+1 chamada Lovable AI por dia** com `gemini-2.5-flash` (gratuito até 06/out/2025 e baratíssimo depois — fração de centavo).
- 1 nova tabela com 1 linha por dia (≈365 linhas/ano — irrelevante).

**Impacto total: praticamente zero**, bem dentro do plano gratuito.

---

## Arquivos que vou criar/alterar

1. **Migration** (nova): cria `relatorios_diarios_enviados` + RLS.
2. **Nova Edge Function**: `supabase/functions/daily-report-advanced/index.ts`.
3. **`supabase/config.toml`**: adicionar `[functions.daily-report-advanced] verify_jwt = false`.
4. **SQL via insert tool**: cria o cron `daily-report-advanced-20h`.
5. **`src/components/aquecimento/AquecimentoDashboard.tsx`**: botão "Enviar relatório agora" (teste manual).

---

## Validação após implementar

1. Disparo manual da função (botão ou tool) → confirmar resposta JSON `{success: true}`.
2. Verificar chegada da mensagem no **62991672674**.
3. Conferir se as 7 seções aparecem com dados reais.
4. Conferir registro em `relatorios_diarios_enviados` (data de hoje, status `ENVIADO`).
5. Confirmar que o cron foi criado (`SELECT * FROM cron.job WHERE jobname = 'daily-report-advanced-20h'`).

Se aprovar, eu implemento tudo de uma vez.
