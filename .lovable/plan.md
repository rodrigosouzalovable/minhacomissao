## Objetivo
Explicar as cobranças de R$ 139,17 e integrar o **billing real da Meta** ao sistema, com painel de custo, diagnóstico das cobranças de 30/06 e alerta em tempo real via WhatsApp quando a Meta cobrar o cartão.

---

## Por que veio R$ 139,17 (contexto pro usuário)

A Meta não cobra "por mensagem". Ela cobra por **conversa de 24h iniciada** (Marketing/Utility/Auth/Service), acumula no *billing threshold* da conta e debita o cartão automaticamente quando esse limite é atingido. R$ 139,17 é aproximadamente **US$ 25 convertido** — o threshold inicial padrão de contas novas. Duas cobranças no mesmo dia = você cruzou o threshold, foi debitado, e voltou a acumular até bater de novo. A estimativa atual do sistema (R$ 0,05 / R$ 0,35) é uma projeção linear que não reflete: conversas Marketing mais caras, câmbio USD→BRL, impostos, e o fato de a unidade cobrada ser conversa (não mensagem).

---

## Como pegar o System User Token (passo a passo pro usuário)

1. Acesse **business.facebook.com** → **Configurações do Negócio**
2. **Usuários** → **Usuários do Sistema** → **Adicionar** (crie um com nome tipo "Lovable Billing")
3. Papel: **Administrador**
4. Clique em **Gerar novo token**:
   - App: selecione o app que já está conectado às suas WABAs
   - Expiração: **Nunca**
   - Permissões: marque `whatsapp_business_management`, `whatsapp_business_messaging` e `business_management`
5. Copie o token gerado e cole quando o sistema pedir via `add_secret` (`META_SYSTEM_USER_TOKEN`)
6. Também preciso do seu **Business Manager ID** (aparece em Configurações do Negócio → Informações do negócio) — vou salvar como `META_BUSINESS_ID`

---

## O que vou implementar

### 1. Backend — Ingestão de custo real da Meta

**Nova tabela** `meta_billing_snapshot`:
```
id, waba_id, dia (date), conversation_category, conversation_type,
conversations_count, cost_usd, cost_brl, fx_rate, criado_em
```
GRANT/RLS: SELECT admin apenas; service_role full.

**Edge function `meta-billing-sync`** (cron a cada 6h):
- Para cada WABA em `meta_whatsapp_instances`, chama `GET /{waba_id}/conversation_analytics` com `granularity=DAILY`, dimensões `[CONVERSATION_CATEGORY, CONVERSATION_TYPE]`, últimos 35 dias
- Também chama `GET /{waba_id}/analytics?fields=cost` (retorna custo real em USD por período)
- Faz upsert em `meta_billing_snapshot`
- Converte USD→BRL usando cotação Awesomeapi (grátis) e salva `fx_rate`

**Nova tabela** `meta_billing_alerts`:
```
id, waba_id, tipo (charge|payment_failed|threshold_reached|limit_change),
valor_usd, valor_brl, detalhes jsonb, ocorreu_em, notificado_em
```

**Atualização do webhook `meta-whatsapp-webhook`** para capturar campos `account_alerts`, `account_update`, `phone_number_quality_update`:
- Persiste em `meta_billing_alerts`
- Dispara notificação via `notificar-admin` para 62991672674 no formato:
  > 🔔 *Cobrança Meta detectada*
  > WABA: {nome}
  > Valor: US$ 25,00 (~R$ 139,17)
  > Motivo: billing threshold atingido
  > Horário: 30/06 14:32

**Edge function `meta-subscribe-billing-fields`**: reassina cada WABA com os campos extras (`account_alerts`, `account_update`) — Meta exige subscribe explícito por campo.

### 2. Frontend — Card "Custo de envios" reformulado

Substituir o `CustoEnvioCard.tsx` atual por versão com 2 abas:

**Aba "Estimativa" (atual)** — mantém o cálculo local R$ 0,05 / R$ 0,35, útil para prever custo antes de disparar campanha.

**Aba "Real Meta"** — lê `meta_billing_snapshot`:
- Cards Hoje / Este mês / Total com valor **real cobrado pela Meta em BRL**
- Breakdown por categoria (Marketing, Utility, Authentication, Service)
- Gráfico dos últimos 30 dias (linha custo diário)
- Badge "Última sincronização: há X min" + botão manual "Sincronizar agora"
- Comparativo Estimativa vs Real (% de divergência)

### 3. Painel de diagnóstico das cobranças de 30/06

Nova página `/admin/meta-billing` (rota protegida admin, adicionada ao sidebar):
- Timeline das cobranças detectadas em `meta_billing_alerts`
- Para cada dia com cobrança >R$50, expandir mostrando as **conversas cobradas naquele dia** (via `conversation_analytics` filtrado por data) com: WABA, categoria, contagem, custo unitário estimado
- Foco especial em 30/06 pra explicar exatamente quais WABAs/conversas geraram os dois R$139,17
- Botão "Exportar CSV"

### 4. Configuração de alertas

Na página `/admin/configurar-meta`, nova seção "Alertas de Cobrança":
- Toggle: receber alerta WhatsApp para cada cobrança
- Toggle: alerta ao atingir X% do threshold antes da cobrança
- Campo: telefone alternativo além do admin default (62991672674)
- Toggle: resumo diário 20h BRT com custo do dia

---

## Detalhes técnicos

**APIs Meta usadas:**
- `GET /{waba_id}?fields=conversation_analytics.start(...)...` — custo e conversas por categoria
- Webhook fields: `account_alerts`, `account_update`, `phone_number_quality_update` (via `meta-subscribe-waba` estendido)

**Câmbio USD→BRL:** `https://economia.awesomeapi.com.br/last/USD-BRL` (sem chave, cacheado 1h)

**Segredos necessários:** `META_SYSTEM_USER_TOKEN`, `META_BUSINESS_ID` (vou pedir via `add_secret` no build)

**Cron:** `meta-billing-sync` a cada 6h + no primeiro carregamento se última sync >2h

**Custo Lovable Cloud:** impacto mínimo — 4 execuções/dia da edge function, tabela leve (~30 linhas/dia por WABA).

---

## Ordem de execução ao entrar em build mode

1. Criar tabelas `meta_billing_snapshot` e `meta_billing_alerts` (migração com GRANT/RLS)
2. Pedir `META_SYSTEM_USER_TOKEN` e `META_BUSINESS_ID` via add_secret
3. Criar edge function `meta-billing-sync` + cron
4. Estender `meta-whatsapp-webhook` para capturar account_alerts + disparar `notificar-admin`
5. Criar `meta-subscribe-billing-fields` e chamar 1x pra cada WABA já cadastrada
6. Refatorar `CustoEnvioCard.tsx` com abas Estimativa/Real
7. Criar página `/admin/meta-billing` (diagnóstico + timeline)
8. Adicionar seção "Alertas de Cobrança" em `/admin/configurar-meta`
9. Rodar `meta-billing-sync` manualmente pra popular os últimos 35 dias e responder definitivamente sobre os R$ 139,17 de 30/06