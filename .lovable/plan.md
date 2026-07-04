# Campanha Meta Multi-Dia com Distribuição Automática

## Objetivo
Na aba **Envio MetaMassa**, importar uma lista grande de clientes e o sistema distribui automaticamente entre os dias, respeitando 80% da cota efetiva de cada número. Cron dispara a fila do dia todo dia às 08:00 BRT.

## Como funciona

### 1. Importação e planejamento
- Usuário cola/importa a lista de clientes na aba **Envio MetaMassa** (fluxo atual mantido).
- Nova opção: **"Agendar campanha multi-dia"** (checkbox) ao lado do botão "Iniciar envio".
- Ao marcar, o sistema calcula:
  - Para cada número selecionado: `cota_diaria_segura = get_effective_daily_quota(id) × 0.8`
  - Soma total de capacidade/dia do pool.
  - Divide a lista em blocos diários até esgotar.
- Mostra preview: "1.500 clientes ⇒ 4 dias (04/07 a 07/07). Domingo pulado. Detalhes por número/dia."
- Botão **"Confirmar agendamento"** grava tudo e encerra — nenhum envio imediato.

### 2. Persistência
Nova tabela `meta_campanha_agendada` (cabeçalho) + `meta_campanha_item` (itens da fila):
- Campanha: nome, template_id, instância_ids, min/max segundos entre envios, folga (0.8 default), status (`agendada`/`em_execucao`/`concluida`/`cancelada`), criado_por.
- Item: campanha_id, cliente (telefone, nome, cpf, atraso, saldo), instancia_id atribuída, data_prevista, status (`pendente`/`enviado`/`erro`/`sem_whatsapp`), enviado_em, erro.

Cada cliente já entra na tabela com a data e a instância definidas no momento do agendamento (round-robin ponderado pela cota de cada número).

### 3. Execução diária (cron)
Nova edge function **`process-campanha-meta-diaria`** chamada por `pg_cron` todo dia às 08:00 BRT (11:00 UTC):
- Bloqueia domingo (regra já existente).
- Para cada campanha `em_execucao`/`agendada` com itens `data_prevista = hoje`:
  - Chama `pick-meta-instance` para escolher número saudável (respeita cota, pausa, YELLOW).
  - Dispara via `send-whatsapp-meta` com delay 40–90s aleatório entre envios.
  - Atualiza status do item, incrementa `enviados_hoje` da instância.
  - Se a instância cair no meio (YELLOW/pausa/cota estourou), realoca os itens restantes daquela instância para outra do pool no mesmo dia; se ninguém sobrar, empurra para o próximo dia útil.
- Envia resumo WA para o admin ao terminar o dia.

### 4. UI
**Aba Envio MetaMassa** ganha 2 sub-abas:
- **Novo envio** (fluxo atual + toggle "Agendar multi-dia").
- **Campanhas agendadas**: lista com status, progresso (X/Y enviados), dias restantes, breakdown por instância. Ações: pausar, retomar, cancelar (marca itens pendentes como cancelados), reagendar dia.

**Monitor de Envios** ganha um card "Campanhas ativas" com progresso do dia.

### 5. Regras já respeitadas (sem alteração)
- Delays em segundos randomizados, min 1s.
- Domingo bloqueado, horário 08–20h BRT.
- Round-robin entre instâncias ativas.
- Pausa automática se qualidade cair para YELLOW.
- `get_effective_daily_quota` já considera `min(fase_rampup, tier)`.

## Detalhes técnicos

### Migration
```sql
CREATE TABLE public.meta_campanha_agendada (
  id uuid PK,
  user_id uuid,
  nome text,
  template_id uuid,
  instancia_ids uuid[],
  min_seg int default 40,
  max_seg int default 90,
  folga_cota numeric default 0.80,
  status text default 'agendada',
  total_itens int,
  enviados int default 0,
  erros int default 0,
  data_inicio date,
  data_fim_prevista date,
  created_at, updated_at
);

CREATE TABLE public.meta_campanha_item (
  id uuid PK,
  campanha_id uuid FK,
  cliente jsonb, -- {telefone, nome, cpf, atraso, saldo}
  instancia_id uuid,
  data_prevista date,
  status text default 'pendente',
  enviado_em timestamptz,
  erro text,
  created_at
);
-- + GRANTs (authenticated CRUD, service_role ALL) e RLS por user_id.
-- Index: (campanha_id, data_prevista, status), (data_prevista, status).
```

### Algoritmo de distribuição (no momento do agendamento)
```
dia = hoje
para cada cliente in lista:
  loop:
    para cada instancia in pool (ordenado por cota_restante desc):
      se instancia.usados_no_dia[dia] < cota_segura(instancia, dia):
        atribui cliente → (instancia, dia)
        break loop
    se ninguém coube: dia = próximo_dia_util(dia); continue
```
`cota_segura` para o dia = `get_effective_daily_quota(id) × 0.80` (assumindo fase atual — não projeta promoção de fase para simplificar; quando a fase avançar, campanhas futuras se beneficiam).

### Cron
```sql
SELECT cron.schedule(
  'process-campanha-meta-diaria',
  '0 11 * * 1-6', -- 08:00 BRT seg-sáb
  $$ SELECT net.http_post(url:='...functions/v1/process-campanha-meta-diaria', ...) $$
);
```

### Edge function `process-campanha-meta-diaria`
- Lock por campanha (evita execução paralela).
- Processa itens `data_prevista <= hoje AND status='pendente'` (pega itens atrasados de dias anteriores).
- Delay entre envios: `min_seg..max_seg` randomizado.
- Ao finalizar: atualiza contadores da campanha; se `enviados+erros == total_itens`, marca `concluida`.

## Fora do escopo
- Escala progressiva dentro da campanha (usuário optou por respeitar só a fase do número).
- Prazo fixo (usuário optou por automático até esgotar).
- Envio manual/híbrido (usuário optou por cron 100% automático).
- Alteração de delays globais, horários, ou lógica de ramp-up existente.

## Ordem de execução
1. Migration (tabelas + GRANTs + RLS + índices).
2. Edge function `process-campanha-meta-diaria` + agendamento pg_cron.
3. Lógica de distribuição + tela de agendamento na aba **Envio MetaMassa**.
4. Sub-aba **Campanhas agendadas** com listagem/ações.
5. Card em Monitor de Envios.
