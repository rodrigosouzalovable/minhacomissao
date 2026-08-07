# Consolidado do dia no formato do chefe + coleta da 3C

Sim, é totalmente possível. O consolidado passa a mostrar o funil em percentuais sobre as bases certas e um ranking de ocorrências de CPC por origem.

## Novo formato da mensagem consolidada

```text
📊 RELATÓRIO CONSOLIDADO — 06/08/2026

📣 Volume Total Acionado: 1.936  (100%)
   ↳ WhatsApp (Meta): 1.936 • Ligações (3C): 0 (Alô: 0)

🗣️ CPC: 227  (11,7% do acionado)
🤝 CPC-A: 19  (8,4% do CPC)

📋 Ratificação de ocorrências em CPC:
  1. WhatsApp — 155
  2. Portal de negociação — 72
  3. Ligação (3C) — 0

📄 Acordos lançados: 19
💵 Valor em acordos: R$ 16.199,05

Por hora (acion. / CPC / CPC-A):
• 8h-9h: 244 / 22 / 1
...
```

Regras:
- Volume Total Acionado = 100% (WhatsApp Meta + ligações 3C).
- CPC = % sobre o Volume Total Acionado.
- CPC-A = % sobre o CPC.
- Ratificação de ocorrências = classificação do CPC por origem (WhatsApp, Portal, Ligação), ordenada do maior para o menor volume, no formato "Nome + Volume". Origens com volume zero aparecem no fim (podem ser omitidas se preferir — hoje deixo visíveis para dar transparência).
- A parcial de hora em hora continua no formato atual, sem mudanças.

## Ligações da 3C zeradas

Diagnóstico confirmado: existem 995 ligações gravadas, todas de 05/08, e o último evento de webhook recebido foi em 05/08 às 16h15 (BRT). Não há registro nenhum de 06/08, e nunca houve sincronização por API (`ultimo_sync` vazio) — ou seja, hoje o sistema depende 100% do webhook da 3C. Não é possível afirmar pelos dados se o webhook foi desativado no painel da 3C ou se simplesmente não houve discagem em 06/08.

O que faço:
1. Rede de segurança: agendar a função `relatorio-3c-sync` para rodar de hora em hora (08h–19h BRT) puxando as ligações do dia pela API da 3C, gravando por `call_id` (sem duplicar o que o webhook já trouxe). Assim, se o webhook cair, o relatório continua correto.
2. Alerta visível: se não houver nenhum evento de webhook nem sync nas últimas 2 horas dentro do horário comercial, o consolidado e a tela de Relatórios avisam "⚠️ Coleta 3C sem dados desde …", para você saber na hora.
3. Registrar `ultimo_sync` a cada execução para monitorar.

## Detalhes técnicos

- `supabase/functions/relatorio-acionamentos-sync/index.ts`: novo bloco de montagem da mensagem quando `consolidado === true`, com percentuais sobre acionado/CPC e ranking ordenado de `cpcWhats`/`cpcPortal`/`cpcLig`. Nenhuma mudança de cálculo de métrica — só apresentação e percentuais.
- Cron novo para `relatorio-3c-sync` (action `sync`, dia corrente), 12 execuções/dia.
- ⚠️ Alerta de custo Lovable Cloud: +12 execuções curtas por dia de uma função já existente (consulta a API externa + upsert por `call_id`, com índice já existente em `(data, hora)`). Impacto estimado muito baixo, sem novo polling no cliente e sem novo canal Realtime. Confirme junto com a aprovação do plano.
- Sem mudanças de schema (uso `ultimo_sync`/`ultimo_webhook_em` que já existem).
