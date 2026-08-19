# Por que a CSIM 47 parou

## Diagnóstico (confirmado no banco)

A campanha **CSIM 47** (1127 destinatários, 31 enviados) está com status `erro` e o motivo gravado é:

```text
Nenhuma instância disponível —
SOUZA 62 8268-4833: teto diário atingido (15/15)
SOUZA 62 8268-4387: teto diário atingido (326/15)
SOUZA 62 8268-9823: teto diário atingido (15/15)
SOUZA 62 8269-0775: teto diário atingido (16/15)
SOUZA 62 8268-4834: teto diário atingido (15/15)
```

Ou seja: não foi bloqueio da Meta nem erro de template. Foi o **freio de rampa (Qualidade GREEN)** que criamos.

Motivo real: as 6 instâncias têm `data_ativacao_api` de 18 e 19/08 (ontem/hoje), então o sistema as classifica como **fase 1 = teto de 15 mensagens/dia**, mesmo com o tier da Meta em 10.000/dia. Uma sexta instância (SOUZA 62 8268-9823) também foi excluída da rodada por falha de entrega — a conta Meta dela está com pendência de pagamento/faturamento (#131042), como no seu print.

## O que propõo fazer

1. **Corrigir a data de ativação das instâncias já rodadas.** Os chips estão em uso há semanas; a data ficou registrada errada. Ajustando a data, eles caem em fase 3/4 (teto 80/200) em vez de fase 1.
2. **Permitir editar a data de ativação e o teto na interface** (Pool Meta no Monitor de Envios), por instância, para não depender de correção manual no banco a cada novo número.
3. **Deixar o motivo do freio visível no card da campanha** com texto claro: "parou porque o teto diário de rampa foi atingido — teto atual X/dia, fase Y" e um botão para retomar depois do ajuste.
4. **Retomar a CSIM 47** (1096 pendentes) após o ajuste, respeitando janela 09–19h e delays 10–15s.

## Decisão que preciso de você

Qual teto diário por número você quer para esses chips já em uso? Sugestão segura: **80/dia** (fase 3) por 3 dias e depois 200/dia. Também posso simplesmente marcá-los como "fora da rampa" (usa o tier da Meta), mas isso aumenta o risco de queda de qualidade.

## Detalhes técnicos

- Fonte do bloqueio: `supabase/functions/_shared/meta-freio.ts` (`faseFromDias`/`tetoBase`) usada por `pick-meta-instance`.
- Correção de dados: update em `meta_whatsapp_instances.data_ativacao_api` / `teto_escada` para as 6 instâncias da campanha.
- UI: novos campos de edição em `src/components/meta/PoolMetaPanel.tsx`; exibição do `status_motivo` humanizado no detalhe da campanha (`CampanhaDetalheDialog.tsx`).
- A instância com erro #131042 continua fora até o método de pagamento ser regularizado no Business Manager — isso é do lado da Meta, não do sistema.
