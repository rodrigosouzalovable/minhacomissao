## Resumo

Implementar Prioridades 2 (instrumentação do ping-pong de aquecimento) e 4 (rampa de fase real), com validação pós-deploy via Teste IA Manual + leitura da tabela de auditoria.

---

## 1. Migration: `whatsapp_conversas_auditoria`

```sql
CREATE TABLE public.whatsapp_conversas_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_origem_id uuid,
  instancia_destino_id uuid,
  numero_origem text,
  numero_destino text,
  etapa text NOT NULL,        -- 'webhook_in' | 'ollama_call' | 'uazapi_send' | 'cascade_skip'
  status text NOT NULL,       -- 'ok' | 'falhou' | 'timeout' | 'ignorado'
  mensagem_original text,
  resposta_gerada text,
  motivo text,
  http_status integer,
  tempo_resposta_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_aud_created ON public.whatsapp_conversas_auditoria (created_at DESC);
CREATE INDEX idx_aud_par ON public.whatsapp_conversas_auditoria
  (instancia_origem_id, instancia_destino_id, created_at DESC);

ALTER TABLE public.whatsapp_conversas_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_read_auditoria" ON public.whatsapp_conversas_auditoria
  FOR SELECT TO authenticated USING (public.is_admin_user(auth.uid()));
-- Inserts apenas via service_role (edge functions). Sem policy de INSERT para usuários.

-- Cron de purga 7 dias (03:00 BRT = 06:00 UTC)
SELECT cron.schedule(
  'purge-conversas-auditoria',
  '0 6 * * *',
  $$ DELETE FROM public.whatsapp_conversas_auditoria WHERE created_at < now() - interval '7 days'; $$
);
```

---

## 2. `supabase/functions/whatsapp-ia-responder/index.ts`

- Adicionar helper `auditar(supabase, row)` (try/catch silencioso, nunca quebra fluxo).
- `callOllama`: medir `Date.now()` antes/depois; logar `[IA-Ollama] OK ms=X model=Y` ou `TIMEOUT/HTTP_ERR`; inserir auditoria etapa=`ollama_call` com `tempo_resposta_ms`, `status` e `resposta_gerada` (truncada 200ch).
- Subir timeout Ollama de **20s → 30s**.
- `enviarMensagemUAZAPI`: capturar `res.status`, body curto; auditar etapa=`uazapi_send` com `http_status` e `motivo` em caso de falha; logar qual endpoint funcionou.
- Auditar `cascade_skip` quando: limite de trocas atingido, número/instância desconectados, fallback usado por Ollama nulo.

## 3. `supabase/functions/whatsapp-chatbot/index.ts`

- No topo do handler: `console.log('[CHATBOT] IN from=<jid> instance=<id> isGroup=<bool> textLen=<n>')` antes dos filtros.
- Quando o `from` corresponde a uma instância ativa em `whatsapp_aquecimento_instancias` (consulta cacheada por execução), inserir auditoria etapa=`webhook_in`, status=`ok`, com `mensagem_original`.
- Se cair em "no_handler" (não é cliente nem fluxo de aquecimento conhecido): auditar etapa=`cascade_skip`, motivo=`no_handler`. Isso responde "o webhook chegou mas foi ignorado?".
- **Não** auditar grupos/status (já filtrados, sem custo extra).

## 4. `supabase/functions/whatsapp-aquecimento/index.ts`

Substituir o cálculo global `TARGET_MESSAGES_PER_DAY` por target por instância:

```ts
const PARES_POR_FASE: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 5, 5: 8 };

const computeTarget = (fase: number, dayOfWeek: number) => {
  const base = PARES_POR_FASE[fase] ?? 1;
  const fator = dayOfWeek === 0 ? 0.4 : dayOfWeek === 6 ? 0.6 : 1.0;
  return Math.max(1, Math.round(base * fator));
};
```

- Remover `r = Math.random()` e os ramos `< 0.5 / 0.85`.
- `eligible = userInstances.filter(i => (i.interacoes_hoje || 0) < computeTarget(i.fase || 1, dayOfWeek))`.
- Log: `[AQUEC] inst=<nome> fase=<n> target=<n> hoje=<n>`.
- Manter pausa 12-14h, cron horário, cooldown 2-4h por par e MAX_PAIRS_PER_CYCLE=12.

---

## 5. Validação pós-deploy

1. Disparar `whatsapp-aquecimento` com `action: "manual-test"` em 2 chips conectados (escolho 2 do par âncora ativo).
2. Aguardar 60s para a cascata rodar.
3. Rodar query: `SELECT etapa, status, motivo, http_status, tempo_resposta_ms, created_at FROM whatsapp_conversas_auditoria ORDER BY created_at DESC LIMIT 20;`
4. Te mando análise: onde o ping-pong morreu (Ollama timeout / webhook não chegou / UAZAPI falhou) e recomendação concreta.

---

## Custo Lovable Cloud

- Tabela auditoria: ~5–10k inserts/dia, com purga 7 dias → tamanho estável <100MB.
- Cron extra: 1 execução/dia, sem custo perceptível.
- Sem aumento na frequência de envios.
- **Impacto financeiro estimado: poucos centavos/mês.** Aceito conforme sua aprovação.

## Memória a atualizar

- Atualizar `mem://features/whatsapp/warming-system-comprehensive` com a nova rampa por fase (1/2/3/5/8 pares/dia).