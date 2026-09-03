# Visibilidade do aquecimento de tier (nova BM)

## 1. Selo no card da instância (aba API Oficial Meta)

Ao lado dos selos atuais (Ativa / BM / saúde / webhook), aparece um selo laranja **"🔥 Aquecimento de tier"** apenas nas instâncias com a opção marcada, com dica ao passar o mouse: "Este número está no motor automático de aquecimento para subir o tier". Visível somente para admin, igual ao interruptor.

Quando já existe trilha do dia para esse número, o selo mostra o progresso resumido: `🔥 Aquecimento 12/45` (destinatários feitos/alvo do dia).

## 2. Aviso quando o aquecimento inicia

No planejamento diário por IA (07h BRT), na primeira vez que um número entra em aquecimento (primeira trilha criada para aquela instância), o sistema manda um WhatsApp para 62991672674 e 62994300880:

```
🔥 Aquecimento iniciado
SOUZA 62 8269-9499
Tier atual: 2.000/dia → alvo: 10.000/dia
Meta de hoje: 45 destinatários únicos (55% UAZAPI / 45% leads)
```

## 3. Acompanhamento diário 12h e 18h

O relatório de aquecimento que já é enviado às 12h e 18h ganha um bloco novo **"Aquecimento de tier (novas BMs)"**, com uma linha por número marcado:

```
🔥 Aquecimento de tier
• SOUZA 62 8269-9499 — 18/45 hoje · únicos 7d: 96
  entregues 16 · lidas 9 · respostas 3 · falhas 1
  tier 2.000 → 10.000 · qualidade GREEN
  ⬆️ tier subiu para 10.000 hoje
• (nenhum número marcado → "motor parado, nenhum número selecionado")
```

Mudanças destacadas quando ocorrerem no dia: tier alterado, qualidade alterada (ex. GREEN → YELLOW), trilha pausada por erro fatal da Meta, teto de gasto atingido.

Sem cron novo: aproveita os dois disparos já existentes de 12h e 18h.

## Detalhes técnicos

- `src/pages/ConfigurarMeta.tsx`: novo selo no bloco de badges do card, condicionado a `inst.aquecimento_meta_ativo && isAdmin`. Progresso vem de uma query já agrupada por instância em `meta_aquecimento_trilha` (dia atual) + contagem de `meta_aquecimento_destino_log`; uma única query por render, `staleTime` alto, sem polling.
- `supabase/functions/meta-aquecimento-planejar/index.ts`: após criar a trilha, se não existir trilha anterior para a instância, gravar em `aquecimento_notificacoes` e chamar `notificar-admin` (round-robin já usado) com a mensagem de início.
- `supabase/functions/meta-aquecimento-relatorio/index.ts`: novo bloco montado a partir de `meta_whatsapp_instances` (filtro `aquecimento_meta_ativo = true`), `meta_aquecimento_trilha` do dia, `meta_aquecimento_destino_log` do dia (contagens por status/resposta) e `meta_instance_daily_metrics`. Detecção de mudança de tier/qualidade comparando com o valor registrado na trilha (`tier_atual`) e no log do dia.
- Nenhuma migração de banco necessária; nenhum cron, polling ou Realtime novo (custo Cloud inalterado).
