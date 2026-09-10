# Teto de R$ 120/dia + aviso de gasto do dia com leads

## 1. Teto diário passa para R$ 120

- O teto do dia de aquecimento passa de R$ 50 para R$ 120 (registro do dia de hoje e valor herdado para os próximos dias).
- Nada mais muda: o motor continua parando sozinho quando o gasto do dia chega no teto e volta no dia seguinte.

## 2. Aviso de gasto no fim do dia

No relatório que já chega às 20h no seu WhatsApp (62991672674) entra um bloco novo, só sobre dinheiro:

- Gasto do dia em mensagens para leads do Google Maps, em reais.
- Quantas mensagens foram enviadas, quantas foram entregues e quantas responderam.
- Custo por resposta obtida (para você ver se está valendo a pena).
- Gasto por número: quanto cada número novo consumiu no dia.
- Quanto sobrou do teto de R$ 120 (ou o horário em que o teto foi atingido).
- O custo das buscas no Google continua aparecendo separado, como já aparece hoje.

## 3. Resposta: como os números de cada BM são usados

Hoje o sistema **não** usa automaticamente os 5 números de uma BM. Ele só usa os números que **você marcou** com "Número de nova BM — entrar no aquecimento de tier". Se a BM tem 5 números e você marcou 2, só esses 2 aquecem.

Dos números marcados, o sistema ainda exige, a cada dia:

- número conectado, com token válido e fora de pausa/quarentena;
- qualidade GREEN ou desconhecida (YELLOW/RED saem e vão para a recuperação);
- estar liberado no pool.

Cada número marcado ganha sua própria meta diária de contatos diferentes (no modo intensivo, cerca de 450/dia para chegar a ~1.300 em 3 dias), e o teto de R$ 120 é **compartilhado por todos** — então, quanto mais números marcados no mesmo dia, mais cedo o teto termina. Com o custo atual (~R$ 18 por número/dia nesse ritmo), R$ 120 cobre cerca de 6 números por dia em ritmo cheio.

Se você quiser que todos os números de uma BM entrem juntos automaticamente, isso é um item separado — diga e eu incluo.

## Detalhes técnicos

- `meta_aquecimento_orcamento`: atualizar `teto_reais` para 120 no dia atual (o carregador herda o último valor para os dias seguintes).
- `google-maps-leads-relatorio-diario`: somar `custo_estimado_brl`/custo por categoria de `meta_aquecimento_destino_log` do dia (fonte lead), agrupar por `instancia_id`, e ler `meta_aquecimento_orcamento` do dia para teto/restante; incluir entregas, respostas e custo por resposta.
- Sem cron novo, sem tabela nova, sem polling — o bloco entra no relatório de 20h que já existe.

## Aviso de custo (Lovable Cloud)

Impacto de infraestrutura praticamente zero (uma consulta agregada a mais, 1x/dia). O custo que sobe é o da Meta: o teto passa de R$ 50 para R$ 120 por dia.
