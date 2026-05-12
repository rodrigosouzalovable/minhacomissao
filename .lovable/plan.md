
# Integração MarketBet — modo TESTE CONTROLADO

Concordo com o protocolo do DeepSeek. Implementação enxuta, sem cron de rotação automática nesta fase — só geração + aplicação manual + monitoramento. Se sticky de 10–30 min derrubar a sessão UAZAPI, descobrimos em horas, não em dias.

## Etapa 0 — Secret

- Adicionar secret `MARKETBET_API_KEY` = `mb_live_7fd354ad43a2af611d638f7edbab1ba7` (será solicitado via tool `add_secret`).

## Etapa 1 — Edge function `marketbet-proxy-manager`

Arquivo: `supabase/functions/marketbet-proxy-manager/index.ts` (`verify_jwt = false` no `config.toml`).

Roteamento por `action` no body JSON (uma única função, mais simples que múltiplas):

| action | Faz | Chamada upstream |
|---|---|---|
| `saldo` | Consulta saldo em GB | `GET /api/v1/proxy/saldo.php` |
| `locais` | Lista estados BR disponíveis | `GET /api/v1/proxy/locais.php?country=br` |
| `gerar` | Gera N proxies (default 1, tipo `fixo`, country `br`, state opcional) | `POST /api/v1/proxy/gerar.php` |
| `aplicar` | Recebe `instance_id` + string de proxy `host:port:user:pass`, parseia, salva em `user_whatsapp_instances` (`proxy_*` colunas) e invoca `uazapi-set-proxy` | DB + chamada interna |

Parser do formato MarketBet: `74.81.81.81:11000:usuario__cr.br;state.saopaulo;city.saopaulo:senha123`
- Split por `:` em 4 partes (host, porta, user com modificadores, senha).
- O `user` inteiro (incluindo `__cr.br;state.x`) vai literal para `proxy_username` — é assim que o roteador da MarketBet seleciona localização.

CORS padrão do projeto. Validação Zod do body. Tratamento `disconnected → fallback:true` quando aplicar.

Audit log: insert em uma nova tabela `marketbet_proxy_log` (acao, payload, resposta, criado_em, user_id).

## Etapa 2 — Tabelas (migration)

```sql
create table marketbet_proxy_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  acao text not null,           -- 'saldo'|'gerar'|'aplicar'
  payload jsonb,
  resposta jsonb,
  sucesso boolean,
  criado_em timestamptz default now()
);
-- RLS: só admin lê/escreve

create table marketbet_proxies_gerados (
  id uuid primary key default gen_random_uuid(),
  proxy_string text not null,   -- string crua retornada
  host text, porta int, username text, password text,
  estado text, cidade text, tipo text,
  aplicado_em_instancia uuid references user_whatsapp_instances(id),
  aplicado_em timestamptz,
  criado_em timestamptz default now()
);
-- RLS: só admin
```

## Etapa 3 — UI: aba "MarketBet" em `/aquecimento`

Novo componente `src/components/aquecimento/MarketBetTestTab.tsx`. Adicionar tab no `Aquecimento.tsx`.

Layout (1 coluna, denso, viewport 1117px):

```text
┌────────────────────────────────────────────────────────┐
│ Saldo MarketBet            [Consultar saldo]           │
│ Total: 1 GB · Usado: 0.15 GB · Disponível: 0.85 GB     │
├────────────────────────────────────────────────────────┤
│ Gerar proxies de teste                                 │
│ Estado: [Goiás ▾] Quantidade: [5] [Gerar]              │
├────────────────────────────────────────────────────────┤
│ Proxies disponíveis (não aplicados)                    │
│  74.81.81.81:11000:user__cr.br;state.goias:pwd  [Apl…] │
│  74.81.81.81:11001:user__cr.br;state.goias:pwd  [Apl…] │
│  ...                                                   │
├────────────────────────────────────────────────────────┤
│ Aplicados — monitor                                    │
│ Chip                  Proxy        Status   Aplicado   │
│ MEMU 37 (62982115479) 74.81…11000  Conec.   há 2h      │
│ MEMU 12 (62991…)      74.81…11001  Caiu     há 12min   │
└────────────────────────────────────────────────────────┘
```

- Botão "Aplicar" abre dropdown com instâncias ativas que ainda não têm proxy MarketBet aplicado.
- Coluna Status puxa do `uazapi-set-proxy` + `test-uazapi-connection` (cache existente em `uazapiConnectionCache`).
- Tudo usa tokens de design (sem cores hardcoded).

## Etapa 4 — Protocolo de teste (você executa, sem código)

1. Consultar saldo (confirma que a integração funciona).
2. Gerar 5 proxies em GO (ou SP se GO não existir — botão `Listar estados` no dev tools).
3. Escolher 5 chips de teste (idealmente já maduros, ≥ 7 dias, sem dor recente).
4. Aplicar 1 proxy/chip pelo botão.
5. Observar por 24 h:
   - Sessão UAZAPI cai a cada 10–30 min? → sticky curto demais, descartar.
   - Chip mantém conectado mas sem banir? → continuar até 7 dias.
6. Ao fim de 7 dias, comparar taxa de banimento dos 5 chips com proxy vs chips sem proxy.

## Etapa 5 — Sem cron, sem rotação automática (por enquanto)

Confirmado contigo da rodada anterior: **adiar #3 (pool/rotação)**. Esta entrega cobre só #1 (consumir API) e #2 (aplicar manual). Cron de rotação fica para depois do veredicto do teste.

## Custos Lovable Cloud

- 1 edge function nova, invocada manualmente (saldo + 1 gerar + 5 aplicar = ~7 invocações no teste).
- 2 tabelas pequenas, RLS admin-only.
- **Custo desprezível.** Já alinhado com a regra "Cloud Cost Awareness".

## Riscos a vigiar

1. Sticky 10–30 min é o ponto mais sensível. Se o `uazapi-set-proxy` precisar reaplicar a cada renovação interna do IP, vai derrubar a sessão. **Hipótese a validar no teste**: a MarketBet pode renovar IP "por baixo" mantendo o mesmo `host:port:user:pass` (como faz com proxy fixo). Se sim, não precisamos reaplicar nada.
2. Strings de proxy contêm `;` e `_` — precisa testar se a UAZAPI aceita o `username` com esses caracteres no `POST /instance/proxy`. Se não aceitar, fazer URL-encode.
3. Latência: todo tráfego do chip vai passar pelo proxy → pode aumentar timeout em envios. O fallback `disconnected:true` já trata.

## Próximo passo

Vou pedir o secret `MARKETBET_API_KEY` e, ao receber confirmação, implementar etapas 1–3. Você executa o protocolo da etapa 4.
