# Aquecimento automático quando a taxa de resposta cai durante a campanha

## O que os dados mostram (últimas 24h)

```text
número                  enviadas  recebidas  lidas   %resp  %lida  qualidade
AMARAL 62 8273-8416        807       283      484     35%    60%    GREEN
SOUZA 62 8269-9096         638        53      348      8%    55%    YELLOW
SOUZA 62 8268-4808         525        76      268     14%    51%    YELLOW  <-- o seu caso
SOUZA 62 8269-9531         390       125      273     32%    70%    RED
AMARAL 62 8275-0662        208        65      120     31%    58%    GREEN
```

Leitura honesta: o número com 525 enviadas e 76 recebidas está sim no grupo de pior engajamento, e o de melhor resposta (35%) é o único com volume alto e ainda verde. Ou seja, o padrão dá suporte à sua suspeita. Mas isso é correlação, não prova: a Meta calcula qualidade principalmente por **bloqueios e denúncias** dos destinatários, e esse dado ela não nos entrega. Há um número em 32% de resposta que está RED, o que mostra que resposta baixa não é o único fator.

## Sobre a estratégia proposta

Vale a pena, com uma ressalva importante: mandar mensagem para os nossos próprios números da UAZAPI **não apaga bloqueio ou denúncia**. O que essa tática faz é (a) gerar conversa real de ida e volta, que sustenta o sinal de engajamento, e (b) — o mais eficaz — **reduzir o ritmo de disparo frio no momento em que o engajamento cai**. O ganho real vem do conjunto: aquecer + frear ao mesmo tempo.

Por isso o plano faz as duas coisas juntas, e não só o aquecimento.

## Como vai funcionar

1. **Vigilância contínua durante a campanha.** A cada 10 minutos o sistema mede, por número, quantas mensagens saíram e quantas voltaram nas últimas 4 horas (janela curta, para pegar o problema no dia, não no dia seguinte).
2. **Três faixas de reação**, por número:
   - resposta abaixo de 18%: liga o aquecimento com os números da UAZAPI e reduz o ritmo do número na campanha (mantém, mas envia menos por hora).
   - resposta abaixo de 12%: aquecimento em ritmo forte e o número passa a receber menos destinatários que os demais no rodízio.
   - resposta abaixo de 8%: o número sai da campanha pelo resto do dia e fica só em aquecimento; volta amanhã com teto reduzido.
3. **Aquecimento de verdade, com resposta.** As mensagens vão para os números da UAZAPI que respondem sozinhos, em intervalos aleatórios, respeitando janela 09h–19h, sem domingo, com limite por número de destino para não repetir sempre o mesmo par.
4. **Aviso no seu WhatsApp** no momento em que um número entra em freio/aquecimento por queda de resposta, com o número, a taxa medida e o que foi feito. Um aviso por número por dia.
5. **Acompanhamento** nos relatórios de 12h e 18h que você já recebe: quais números foram freados, quanto de aquecimento foi feito e se a taxa de resposta melhorou.

## Detalhes técnicos

- Nova função `meta-engajamento-guardiao` (cron a cada 10 min, 09h–19h BRT, sem domingo): para cada instância `provider='meta'` e ativa, agrega `meta_whatsapp_mensagens` por `direcao` na janela de 4h (mínimo de 60 saídas para ter significado estatístico) e grava a faixa em `meta_instance_freio_diario` (`teto_efetivo`, `motivo_reducao`, `resposta_pct`) + liga `aquecimento_meta_ativo` e `recuperacao_proximo_envio_em = now()` na instância.
- Novas colunas em `meta_envio_pool_config`: `guardiao_ativo`, `guardiao_janela_horas` (4), `guardiao_min_saidas` (60), `resp_pct_atencao` (18), `resp_pct_forte` (12), `resp_pct_corte` (8).
- `pick-meta-instance`: hoje o modo `sem_teto_global` ignora o freio (linha ~249). Passa a respeitar o freio quando a causa é `guardiao_resposta`, aplicando fator de ritmo 0,6 / 0,3 / 0 conforme a faixa — os bloqueios reais da Meta continuam como estão.
- `meta-aquecimento-tick`: aceita alvo dinâmico do guardião (meta extra do dia) e prioriza `fonte='uazapi'` nesses casos; mantém `maxPorDestino` e o log em `meta_aquecimento_destino_log`.
- Avisos via `notificar-admin` para 5562991672674 e 5562994300880, `chaveIdempotencia` por número/dia; bloco novo no `meta-aquecimento-relatorio` de 12h/18h.
- Índice em `meta_whatsapp_mensagens (instancia_id, criado_em, direcao)` se ainda não existir, para as agregações da janela de 4h.

## Custo (Lovable Cloud)

Isto adiciona um cron a cada 10 minutos com consultas agregadas e mais envios de aquecimento (mensagens Meta pagas, entre nossos próprios números). Aumento de custo real: aprox. 100 execuções/dia de função + o custo das mensagens de aquecimento. Em contrapartida, o freio reduz disparo frio, o que reduz custo de campanha. Confirme antes de eu implementar.

## Ajustes possíveis antes de implementar

- Intervalo do cron: 10 min (mais reativo, mais custo) ou 30 min (mais barato).
- Faixas 18/12/8% podem ser afrouxadas se você achar que cortariam números demais hoje.
