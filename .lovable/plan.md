
## Custo real Meta hoje (09/07/2026) — pesquisado agora

Fonte: rate card oficial da Meta em `developers.facebook.com/docs/whatsapp/pricing` (vigente 01/07/2026), cruzado com Gupshup, Omnidigital e Whautomate.

| Categoria | Preço/mensagem (USD) | ~BRL (câmbio 5,50) |
|---|---|---|
| **Utility (utilidade)** | **US$ 0,0068** | ~R$ 0,037 |
| Authentication | US$ 0,0068 | ~R$ 0,037 |
| Marketing | US$ 0,0625 | ~R$ 0,344 |
| Service / não-template dentro da CSW | US$ 0 | R$ 0 |
| Utility dentro da CSW aberta (24h) | US$ 0 | R$ 0 |

**A IA da Meta te passou errado:** "0,035 USD" não corresponde a nenhuma categoria BR hoje. O valor real de utility no Brasil é **US$ 0,0068** (5x menor). Provavelmente ela confundiu com rate antigo pré-julho/2025 ou com authentication-international de outro país.

**Onde seu sistema está desatualizado:**
- `meta-billing-sync/index.ts`: UTILITY 0,008 (18% acima do real) e AUTHENTICATION 0,0315 (**4,6× acima do real**).
- `useMetaWhatsAppCusto.ts`: preços em BRL fixos, sem câmbio, sem desconto de CSW.
- Nenhum dos dois desconta envios grátis dentro da janela de 24h.

---

## Plano — controle e redução de custo

### Etapa 1 — Corrigir a base de cálculo (sem custo extra)

1.1 Atualizar `PRECO_USD` em `supabase/functions/meta-billing-sync/index.ts`:
```
MARKETING: 0.0625
UTILITY: 0.0068       (era 0.008)
AUTHENTICATION: 0.0068 (era 0.0315 — erro grande)
SERVICE: 0
```

1.2 Atualizar `src/hooks/useMetaWhatsAppCusto.ts` para consumir `meta_billing_snapshot` (dados reais da Meta) em vez de estimar por template. Fallback só quando ainda não sincronizou.

1.3 Registrar `pricing.type` e `pricing.category` no webhook `meta-whatsapp-webhook` → gravar em `meta_whatsapp_envios_log` uma coluna `foi_gratis boolean` (quando `pricing.type = free_customer_service`). Assim o painel separa "cobrado" de "grátis dentro da janela".

### Etapa 2 — Relatório diário via WhatsApp (o que você pediu)

2.1 Nova edge function `daily-report-meta-billing` (baseada no padrão `daily-report-whatsapp` / `notificar-admin` que já existem):
- Roda todo dia às **08:30 BRT** via pg_cron (não em domingo — regra Core do projeto).
- Executa `meta-billing-sync` para ter dados frescos das últimas 24h.
- Monta mensagem e envia via `notificarAdmin` para 62991672674 (WhatsApp admin).

Exemplo do relatório que chega no seu WhatsApp:
```
💰 Custo Meta WhatsApp — 08/07/2026

Ontem: R$ 47,32  (US$ 8,60)
  📢 Marketing:    82 msgs · R$ 28,21
  🔧 Utility:     530 msgs · R$ 19,11
  ✅ Grátis(CSW): 1.204 msgs · R$ 0,00

Mês atual (1-8/jul):   R$ 312,48
Projeção fim do mês:    R$ 1.210,86
Meta configurada:       R$ 800,00  ⚠️ EXCEDERÁ

Top 3 templates mais caros:
  1. promo_black (MKT) — 45 envios — R$ 15,48
  2. lembrete_boleto (UTIL) — 210 envios — R$ 7,77
  3. cobranca_atraso (MKT) — 22 envios — R$ 7,57

📌 Dica do dia:
  60% dos utility foram DENTRO da janela (grátis).
  Se movesse "promo_black" p/ dentro da janela,
  economizava R$ 15,48/dia.
```

2.2 Nova tabela `meta_billing_meta_mensal` (limite/alerta que você define):
```
id, mes_ano, limite_brl, alerta_50pct_enviado, alerta_80pct_enviado, alerta_100pct_enviado
```
Quando projeção diária > limite → alerta extra no WhatsApp na hora.

2.3 Card de configuração em `MetaBilling.tsx`: "Meta mensal de gasto" + toggle "Receber relatório diário" + horário.

### Etapa 3 — Ações que reduzem custo AGORA

Além do relatório, o plano identifica onde economizar:

**A) Utility dentro da CSW = grátis.** Desde 01/07/2025 a Meta não cobra utility templates enviados nas 24h após o cliente ter respondido. Ação: nova tela "Diagnóstico de envios" mostrando quantos % dos seus utility hoje estão sendo cobrados porque foram fora da janela. Sugestão automática: reordenar envios para logo após o cliente responder.

**B) Templates classificados como MARKETING que deveriam ser UTILITY.** Marketing custa **9× mais** (US$ 0,0625 vs US$ 0,0068). Ação: aba de auditoria em `MetaTemplates` marcando templates suspeitos (palavras como "boleto", "lembrete", "confirmação", "vencimento", "acordo") aprovados como MARKETING — sugestão de reclassificar na Meta.

**C) Volume tiers.** A partir de certos volumes/mês o utility BR cai ainda mais automaticamente. Relatório mostra em qual tier você está e quanto falta para o próximo.

**D) Guardrail duro.** Nova tabela `meta_billing_guardrail` (já existe!). Vou popular com `limite_diario_brl` e `pausar_ao_estourar`. Quando o gasto do dia bate no limite, envios não-essenciais ficam bloqueados até 00h.

### Etapa 4 — Painel de acompanhamento

Card novo em `MetaBilling.tsx`:
- Gasto de hoje vs média dos últimos 7 dias.
- Projeção de fim de mês baseada no ritmo atual.
- % de envios grátis (dentro da CSW) — quanto maior, melhor.
- Divisão marketing vs utility (visual: você quer virar essa proporção).

---

## ⚠️ ALERTA DE CUSTO ALTO LOVABLE CLOUD

Este plano adiciona:
- **1 cron novo/dia** (`daily-report-meta-billing` — 1 execução às 08:30). Custo Cloud desprezível.
- **1 coluna** em `meta_whatsapp_envios_log` (`foi_gratis boolean`). Custo zero.
- **1 tabela** pequena (`meta_billing_meta_mensal`, ~12 linhas/ano). Custo zero.
- Nenhum polling novo, nenhum Realtime novo, nenhum edge function em loop.

**Impacto no Cloud: mínimo.** Impacto na sua fatura da Meta: potencialmente **-40% a -70%** se você reclassificar marketing→utility e mover utility para dentro da janela.

---

## Fora de escopo

- Não vou reprocessar histórico já cobrado — só corrijo daqui para frente.
- Reclassificar templates na Meta você precisa fazer no Business Manager — o sistema só sugere.
- Não vou alterar motor de envio, warming, round-robin ou permissões.
- Não vou mexer em `client.ts`, `types.ts`, `.env`, `config.toml`.

---

## Ordem de execução após aprovar

1. Corrigir preços (`meta-billing-sync` + `useMetaWhatsAppCusto`) — 5 min.
2. Criar `daily-report-meta-billing` + cron 08:30 BRT — 15 min.
3. Adicionar `foi_gratis` no log + capturar no webhook — 10 min.
4. Criar tabela `meta_billing_meta_mensal` + UI de configuração de limite — 15 min.
5. Aba "Diagnóstico" com template audit + % grátis — 20 min.

Total estimado: ~1h de build. Após aprovar, aplico tudo numa passada.
