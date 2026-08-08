# Por que a AMARAL 62 8232-4186 não dispara (e como corrigir)

## Causa confirmada

A instância está perfeita: `CONNECTED`, qualidade `GREEN`, TIER_250, 119/250 hoje, sem pausa e sem restrição. O bloqueio não vem da Meta — vem de um guardrail interno do seletor de instâncias (`pick-meta-instance`).

Esse guardrail olha as métricas de **ontem** (07/08) da instância:

```text
enviadas: 167   falharam: 15   bloqueadas: 0
taxa considerada = (bloqueadas + falharam) / enviadas = 8,98%
limite configurado = 2%
```

Como 8,98% > 2%, a função descarta a instância silenciosamente. Sendo ela a única selecionada, o job encerra com "Nenhuma instância disponível (cota, pausa ou qualidade)" e 0/20 enviados (foi o que aconteceu nos jobs de 13:02 e 13:10 de hoje).

O ponto errado: as 15 "falhas" de ontem foram **falhas técnicas de template/rede** (ex.: erro de header #132018), não bloqueios de usuário. Mesmo assim entram na mesma conta que "bloqueadas", que está em 0. Ou seja, o número está sendo punido por erro nosso de configuração, não por reputação.

## O que será feito

1. **Separar bloqueio de reputação de falha técnica** no guardrail: passar a considerar apenas `bloqueadas` (bloqueios reais de usuário) e, opcionalmente, uma fração pequena das falhas — falhas de template/mídia/rede não contam como risco de banimento.
2. **Nunca descartar 100% em silêncio**: quando a única instância selecionada é reprovada por guardrail (e não por qualidade/pausa/restrição da Meta), em vez de encerrar o job, ela é usada com teto reduzido (30% da cota) e o motivo aparece no aviso do WhatsApp.
3. **Mensagem de encerramento específica**: trocar o genérico "cota, pausa ou qualidade" por o motivo real por instância (ex.: "AMARAL 4186 reprovada no guardrail: 9% de falhas ontem"), para não parecer problema da Meta.
4. **Limite configurável e mais realista**: expor o limite de block-rate no config do pool (padrão 2% para bloqueios reais) e exigir volume mínimo maior antes de aplicar o guardrail.
5. **Liberar o disparo agora**: com a correção, a AMARAL volta a ser elegível imediatamente e a campanha de 20 contatos pode ser reiniciada.

## Detalhes técnicos

- `supabase/functions/pick-meta-instance/index.ts`, bloco de guardrails (~linhas 140-150): o `continue` por `blockRate` passa a usar só `bloqueadas`; falhas técnicas viram apenas redução de teto (`tetoQualidade`), não exclusão.
- Cada candidato descartado registra `motivo_descarte`; a resposta de `sem_disponivel` passa a devolver essa lista.
- `supabase/functions/envio-meta-massa-tick/index.ts`: usa os motivos detalhados no `status_motivo` e na notificação do WhatsApp.
- Fallback: se todos os candidatos foram descartados apenas por guardrail interno, reaproveita o de melhor score com teto de 30%.
- Sem mudança em round-robin, delays (30-60s), quality gate de YELLOW/RED nem na pausa automática da Meta.
