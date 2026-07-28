## Bloqueio automático de custo — Google Maps Leads

Camada de segurança que garante que o módulo nunca ultrapasse a franquia gratuita mensal da Google Places API (New).

### Observação importante sobre a contagem

Hoje `google-maps-buscar-leads` faz até **3 chamadas paginadas** por busca (pageSize=20 × 3 = 60 leads). O SKU cobrado é **Text Search Pro** (~US$32/1000 chamadas). A franquia gratuita da Google é de **US$200/mês**, o que dá ~**6.250 chamadas Places** — não "buscas".

Vou contar **chamadas de API** (não buscas do usuário), porque é o que a Google fatura. O limite de 5.000/4.800 do briefing vira 5.000/4.800 **chamadas Places**, o que corresponde na prática a ~1.600 buscas de 60 leads. Se preferir contar por busca (cada clique = 1), me diga no aprovação e ajusto antes de implementar.

### 1. Migration — tabela de uso

`public.google_maps_uso_mensal`:
- `mes_referencia` date (PK, sempre dia 01)
- `total_consultas` int default 0 (chamadas Places incrementadas)
- `limite_maximo` int default 5000
- `limite_bloqueio` int default 4800
- `alerta_percentual` int default 80
- `updated_at` timestamptz

RLS: SELECT/UPDATE apenas admin. GRANT para authenticated + service_role. Índice único em `mes_referencia`.

Função `public.gm_incrementar_uso(qtd int)` (SECURITY DEFINER): faz `INSERT ... ON CONFLICT (mes_referencia) DO UPDATE SET total_consultas = total_consultas + qtd`. Garante linha do mês corrente automaticamente — dispensa cron de reset (o "reset" acontece naturalmente ao virar o mês, e o histórico dos meses anteriores fica preservado).

### 2. Edge Function `verificar-limite-google-maps`

- Admin-only (mesmo padrão do `google-maps-buscar-leads`).
- Lê/cria linha do mês corrente (America/Sao_Paulo).
- Retorna: `pode_buscar`, `consumo_atual`, `limite_maximo`, `limite_bloqueio`, `percentual_consumido`, `data_reset` (dia 01 do próximo mês), `nivel` (`normal|alto|critico|bloqueado`), `mensagem` humanizada conforme tabela do briefing.

### 3. Modificar `google-maps-buscar-leads`

- Antes do loop: chamar o verificador via SQL direto (RPC), abortar com 429 e mensagem amigável se `pode_buscar=false`.
- Dentro do loop de páginas: após cada resposta 2xx da Places API, chamar `gm_incrementar_uso(1)`. Assim contamos chamadas reais, não estimadas.
- Antes de pedir a próxima página: reavaliar o consumo; se cruzou o `limite_bloqueio` no meio da busca, interromper a paginação (não desperdiça o que já veio) e marcar `busca.status = 'parcial_limite'`.

### 4. UI — `src/pages/GoogleMapsLeads.tsx`

Novo card no topo (`ConsumoMensalCard`):
- "Consumo do mês: **X** de **5.000** chamadas Places"
- Barra de progresso Tailwind com cor semântica:
  - verde ≤80%, amarelo 80–95%, vermelho 95–100% do bloqueio, cinza ≥bloqueio
- Alerta contextual (Alert do shadcn) com a mensagem correspondente ao nível.
- Rodapé: "O contador reinicia em **01/MM/AAAA**".
- Botão "Buscar" desabilitado quando `nivel === 'bloqueado'`, com tooltip explicativo.
- `useQuery(['gm-limite'])` chamando o verificador; `refetch` após cada busca concluída.

### 5. Reset automático

Não precisa de pg_cron: a função `gm_incrementar_uso` sempre grava/atualiza a linha do mês corrente (`date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')`), então em 01/MM o contador do novo mês começa em 0 automaticamente e os meses anteriores ficam intactos para auditoria.

### Respostas às 4 perguntas do briefing

1. Confirmo o **conceito** de franquia gratuita (US$200/mês da Google), mas o número exato depende do que contamos — ver observação acima. Sugiro 5.000 **chamadas Places** como limite conservador.
2. Bloqueio em **4.800** (200 de folga) como pedido — configurável na tabela.
3. Alerta por e-mail: **fora do escopo desta fase** para manter simples; o card no topo + WhatsApp admin (se quiser, adiciono depois reusando o `admin_notificacoes_config` existente) resolve. Confirma se quer WhatsApp/e-mail agora ou numa próxima iteração?
4. Reset automático em 01/MM: **sim**, via chave de mês na tabela (sem cron).

### Arquivos afetados

- Nova migration: tabela + função + RLS + grants.
- Nova edge function: `supabase/functions/verificar-limite-google-maps/index.ts`.
- Editar: `supabase/functions/google-maps-buscar-leads/index.ts`.
- Editar: `src/pages/GoogleMapsLeads.tsx` (novo card + desabilitar botão).

### Fora do escopo (confirmar se quer incluir)

- Alertas por e-mail/WhatsApp ao cruzar 80%/95%.
- Contagem por "busca" em vez de "chamada Places".
- Painel admin para editar `limite_maximo`/`limite_bloqueio` pela UI (por ora só via SQL/tabela).
