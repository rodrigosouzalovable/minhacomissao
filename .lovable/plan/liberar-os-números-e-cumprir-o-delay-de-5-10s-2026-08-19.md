# Liberar os números e cumprir o delay de 5–10s

## O que os dados mostram (confirmado no banco)

A campanha **CSIM 47 2** (1053 destinatários, 36 enviados, delay 5–10s) está com status `erro` e o motivo gravado é:

```text
Nenhuma instância disponível —
SOUZA 62 8268-4833: teto por hora atingido (12/12)
SOUZA 62 8268-9823: teto por hora atingido (12/12)
SOUZA 62 8268-4387: teto diário atingido (335/80)
...
```

Causa real do ritmo de ~1 msg/46s: o freio de rampa está com **`cota_max_hora = 12`** por número. Com 4 instâncias na campanha, o teto físico é 48 msg/hora (~1 a cada 75s) — não importa o delay de 5–10s configurado. Além disso os tetos diários das instâncias estão em 80/dia (fase 3), então a campanha para depois de poucas centenas.

O motor de envio em si **já respeita** o delay ao milissegundo quando não há freio: o tick aguarda o delay sorteado dentro da mesma execução para delays de até 25s. O que está atrasando é o freio, não o relógio.

## O que vou fazer

1. **Modo Turbo (sem freio) no Pool Meta**: um interruptor no painel Pool Meta que desliga o freio de rampa/qualidade — sem teto por hora, sem teto diário de fase, sem corte por engajamento. Fica explícito no próprio card que o risco de queda de qualidade/ban é assumido, com o interruptor podendo ser desligado a qualquer momento.
2. **Liberar as instâncias da CSIM 47 2**: marcar os números da campanha como "qualidade liberada manualmente" e ampliar o teto diário para o tier real da Meta, para que não voltem a travar em 80/dia.
3. **Elevar o teto por hora**: `cota_max_hora` passa de 12 para um valor compatível com 5–10s (720/h por número), configurável na interface junto do Modo Turbo.
4. **Retomar a CSIM 47 2** (1017 pendentes) do ponto onde parou, mantendo o delay 5–10s. Ritmo esperado: ~1 msg a cada 7,5s → término em ~2h07 em vez de ~12h55.
5. **Mensagem clara no card** quando a parada for por freio, já indicando que o Modo Turbo remove esse limite.

Observações que continuam valendo: o número *8268-9823* seguirá falhando enquanto houver pendência de faturamento na Meta (#131042), e a janela de envio 09–19h continua ativa (posso remover também, se você quiser).

## Aviso de custo (Lovable Cloud)

Não cria cron, tabela nem polling novo. O único efeito é que a função de envio fica ativa mais tempo por execução (esperando os 5–10s entre disparos) — comportamento que já existe hoje. O aumento de custo é o mesmo da campanha rodando mais rápido em menos tempo total; na prática o custo total tende a ficar igual ou menor, porque a campanha termina em ~2h em vez de ~13h.

## Detalhes técnicos

- `meta_envio_pool_config`: `freio_ativo = false`, `cota_max_hora = 720`, `pct_max_cota_meta = 100`.
- `meta_whatsapp_instances` das 4 instâncias da campanha: `qualidade_liberada_manual = true`, `quarentena_ate = null`.
- `meta_instance_freio_diario` do dia: `teto_efetivo` elevado ao tier da Meta para essas instâncias.
- `src/components/meta/PoolMetaPanel.tsx`: novo bloco "Modo Turbo" (switch `freio_ativo` invertido + campo `cota_max_hora`) com aviso de risco.
- `src/components/meta/CampanhaDetalheDialog.tsx`: texto do motivo de parada por teto aponta para o Modo Turbo.
- `supabase/functions/pick-meta-instance/index.ts` e `envio-meta-massa-tick/index.ts`: sem mudança de lógica — já honram `freio_ativo=false` e o delay exato do usuário.
