# Distribuição igual dos disparos por número, respeitando o limite da BM

## O que muda
- A campanha passa a escolher sempre o número que **enviou menos nesta campanha**, em vez de favorecer números pelo tier ou pela idade. Assim, todos os números saudáveis enviam quantidades parecidas.
- O limite de cada BM continua valendo: quando a BM chega ao limite de 24h, os números dela saem do rodízio e os outros continuam.
- Números YELLOW/RED (quando liberados manualmente) recebem no máximo **30% da média** dos números GREEN da campanha. Eles nunca passam à frente dos GREEN.
- Ao cair para YELLOW/RED no meio da campanha, o número fica limitado na hora, sem "compensar" o que já enviou.

## Campanha "UME e Odres 3"
- A correção vale para a campanha em andamento logo após a publicação, sem reiniciá-la. Os números que enviaram pouco passam a receber os próximos envios até equilibrar.
- Antes de aplicar, confiro a contagem atual por número para confirmar o desequilíbrio e mostro o antes/depois.

## Custo (Lovable Cloud)
Sem novo cron, polling ou Realtime. Apenas uma contagem agregada por campanha a cada escolha de número, usando índice existente. Impacto desprezível.

## Detalhes técnicos
- `supabase/functions/_shared/pick-meta-instance-handler.ts`: aceitar `job_id`; carregar contagem de envios por instância na campanha (agregado único); trocar o score por "menor uso na campanha" com desempate aleatório; YELLOW/RED só elegíveis se `uso < 0,3 × média GREEN`; manter filtros de cota da BM, bloqueios reais e pausa.
- `supabase/functions/envio-meta-massa-tick` e `-burst`: passar `job_id` ao escolher instância (ou aplicar a mesma regra se escolherem localmente).
- Teste em `tests/` com a regra: candidato com menos envios vence; YELLOW acima de 30% da média GREEN é excluído; BM esgotada é excluída.
