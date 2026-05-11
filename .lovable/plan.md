## Objetivo

Reduzir padrões previsíveis no aquecimento aplicando 2 melhorias enxutas (sem custo extra de Cloud, sem mudar domingo, sem proxies por enquanto).

## Escopo aprovado

1. **Calendário centralizado** (#1) — domingo continua como hoje (fator 0.4 + sem lembretes).
2. **Tempo de resposta variado por personalidade** (#2 reduzido) — só delays, sem pools de frases novas.
3. **Adiado**: rotação de proxies, janelas horárias por personalidade, pools de frases por personalidade.

---

## 1. Calendário de comportamento (centralizado)

### Nova tabela
```sql
CREATE TABLE whatsapp_aquecimento_calendario (
  dia_semana INTEGER PRIMARY KEY,  -- 0=dom..6=sab
  horario_inicio TIME NOT NULL,
  horario_fim TIME NOT NULL,
  pausa_inicio TIME,               -- almoço (NULL = sem pausa)
  pausa_fim TIME,
  fator_volume NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  quantidade_status INTEGER NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true
);
```

### Valores iniciais (preserva comportamento atual)
| Dia | Início | Fim | Pausa | Fator | Status |
|---|---|---|---|---|---|
| Dom | 09:00 | 18:00 | – | 0.4 | 0 |
| Seg–Qui | 07:00 | 21:00 | 12-14 | 1.0 | 1 |
| Sex | 08:00 | 22:00 | 12-14 | 1.1 | 2 |
| Sáb | 09:00 | 18:00 | – | 0.6 | 1 |

### Edge functions afetadas (substituir hardcode)
- `aquecimento-envio-autosave` — usa hora/pausa/fator do dia
- `aquecimento-grupo-conversa` — mesmo
- `aquecimento-status-reagir` — mesmo
- `aquecimento-perfil-completar` — só horário
- (cron `daily-report-aquecimento` mantém 20h fixo)

### Helper compartilhado
Criar `supabase/functions/_shared/calendario-aquecimento.ts` com `getCalendarioHoje(supabase)` que retorna `{dentroJanela, fator, maxStatus}`. Cacheável por execução.

### UI
Aba nova em `/aquecimento` → "Calendário" — tabela editável dos 7 dias (admin only).

---

## 2. Personalidade do chip (só delays)

### Migração
```sql
CREATE TYPE personalidade_chip AS ENUM (
  'rapido','equilibrado','reflexivo','noturno'
);

ALTER TABLE user_whatsapp_instances
  ADD COLUMN personalidade personalidade_chip DEFAULT 'equilibrado';

-- Atribui aleatório nos chips existentes
UPDATE user_whatsapp_instances SET personalidade = (
  ARRAY['rapido','equilibrado','reflexivo','noturno']::personalidade_chip[]
)[1 + floor(random()*4)::int]
WHERE personalidade IS NULL;
```

### Mapeamento de delays (em segundos)
| Personalidade | Delay resposta IA | Delay próximo envio |
|---|---|---|
| rapido | 30–120 | 60–300 |
| equilibrado | 90–300 | 180–600 |
| reflexivo | 300–900 | 600–1800 |
| noturno | 120–600 (boost 19h–02h) | 240–900 |

### Edge functions afetadas
- `whatsapp-ia-responder` — lê `personalidade` do chip que vai responder e calcula delay.
- `aquecimento-envio-autosave` — multiplica jitter pela personalidade.
- `aquecimento-grupo-conversa` — usa para espaçamento entre msgs.

### UI
Coluna "Personalidade" em `AquecimentoDashboard` + botão "Sortear" (atribuição aleatória individual ou em massa).

---

## 3. O que NÃO entra

- Rotação de proxies (#3) — adiado até pool de proxies existir.
- Janelas horárias por personalidade — conflita com calendário; descartado.
- Pools de frases por personalidade — Dialogos Pool atual já cobre.
- Domingo zerado — preserva regra atual (fator 0.4).

---

## Validação

- Após aplicar: rodar SELECT em `whatsapp_aquecimento_calendario` e confirmar 7 linhas.
- Sortear personalidade e ver coluna nova preenchida em todos chips ativos.
- Aguardar próximo ciclo cron e verificar logs `aquecimento-envio-autosave` mostrando `fator_dia` e `personalidade`.
- Sem aumento de custo Cloud: 1 SELECT extra por execução cron, cacheado.

## Memórias a salvar

- `mem://features/whatsapp/warming/calendario-comportamento` — tabela central + dias
- `mem://features/whatsapp/warming/personalidade-chip` — 4 perfis e seus delays
