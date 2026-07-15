## Objetivo

1. **Relatório de aquecimento Meta** — WhatsApp diário às 12h e 18h BRT com status ping-pong dos números Meta.
2. **Cotação USD/EUR** — consulta diária com notificação do valor atual e do menor valor histórico registrado (data-base 15/07/2026 fixa na mensagem).
3. Ambos enviados para **62991672674** e **62994300880**.

---

## 1) Relatório de aquecimento Meta

### Nova edge function: `meta-aquecimento-relatorio`
Lê últimas 24h de `meta_aquecimento_pares` + `meta_instance_daily_metrics` + `meta_whatsapp_instances` e monta mensagem com:

- Total de trocas nas últimas 24h e hoje
- Por instância: nome, qualidade (GREEN/YELLOW/RED), estado_pool, quantas mensagens enviou/recebeu no aquecimento
- Matriz emissor → receptor (quem mandou pra quem e quantas vezes)
- Instâncias inelegíveis (pausadas, RED, banidas) com motivo
- Se aquecimento está ativo/inativo e template configurado

Envio via helper `notificarAdmin` (round-robin UAZAPI) — mas mandando para os 2 números fixos definidos no código (não usa `admin_phone`), reaproveitando a lógica de escolha de instância conectada.

### Agendamento
`pg_cron` 2x/dia: `0 15 * * *` e `0 21 * * *` (12h e 18h BRT em UTC) → `net.http_post` para a função.

---

## 2) Cotação USD/EUR + menor histórico

### Nova tabela: `cotacoes_moedas`
```
id, data (date, unique), usd numeric, eur numeric, created_at
```
Grants padrão + RLS (admin-only leitura via `has_role`).

### Nova tabela: `cotacoes_minimas`
```
moeda text pk ('USD','EUR'), valor numeric, data_registro date, updated_at
```
Guarda o menor valor histórico por moeda.

### Nova edge function: `consultar-cotacao-diaria`
- Busca cotação atual USD e EUR via API pública AwesomeAPI (`https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL`) — sem chave.
- Insere em `cotacoes_moedas` (upsert por data).
- Compara com `cotacoes_minimas`; se menor, atualiza.
- Monta mensagem:
  > 💱 *Cotação do dia*
  > Hoje o valor do dólar é R$ 5,10 e o euro é R$ 5,83.
  > Menor valor registrado: USD R$ 5,05 e EUR R$ 5,70, desde 15/07/2026.
- Se bateu novo mínimo, adiciona "🎉 Novo mínimo histórico registrado hoje!".
- Envia para os 2 números via helper compartilhado.

### Agendamento
`pg_cron` 1x/dia às 09h BRT (`0 12 * * *` UTC).

---

## 3) Refactor do helper de envio

Ajustar `_shared/notificar-admin.ts` (ou criar `_shared/notificar-numeros.ts`) para aceitar **lista de números** em vez de só ler `admin_phone`. Mantém round-robin de instâncias UAZAPI conectadas, idempotência via `admin_notificacoes_log`. Reutilizado pelas duas features.

---

## Estrutura técnica (para revisão)

**Migrations:**
- `cotacoes_moedas` + `cotacoes_minimas` (com GRANTs e RLS admin-only)
- Seed em `cotacoes_minimas` com valores iniciais nulos (primeira execução preenche)
- `pg_cron` jobs via `supabase--insert` (contém URL+anon key)

**Edge functions novas:**
- `meta-aquecimento-relatorio/index.ts`
- `consultar-cotacao-diaria/index.ts`

**Edge functions editadas:**
- `_shared/notificar-admin.ts` — novo parâmetro opcional `destinatarios: string[]`

**Config:**
- `supabase/config.toml` — `verify_jwt = false` para as 2 novas funções

**Sem alterações de UI** — tudo backend/agendado.

---

## Alerta de custo (Cloud)

- 2 novos cron jobs: aquecimento-relatorio (2x/dia = 60/mês) + cotacao (1x/dia = 30/mês). Baixo impacto (~90 execuções/mês somadas, cada uma < 5s).
- API AwesomeAPI é gratuita e sem chave.
- Sem polling novo no cliente, sem realtime channel novo.

**Impacto estimado: desprezível.** Prossigo?
