# Fazer a campanha respeitar o delay exato (10–15s)

## O que os dados mostram

Campanha atual (881 contatos, 133 enviados, `min_seg=10`, `max_seg=15`, modo serial):

- Intervalo real entre envios: mediana **20,1s**, média **21,4s**, mínimo 12,8s, máximo 67,4s.
- Ou seja: está enviando a cada ~20s, e não a cada 10–15s. O tempo estimado exibido (~4h27) está coerente com o ritmo real, mas o ritmo real está errado.

## Causa confirmada

O envio é feito por um "tick" que processa **1 mensagem por campanha por execução** e depois agenda `proximo_em = agora + delay sorteado (10–15s)`. Quem acorda esse tick é um agendamento de banco que roda **a cada 10 segundos**.

Resultado: qualquer delay entre 11s e 20s só é atendido no próximo múltiplo de 10 → praticamente sempre 20s. Delays menores que a granularidade do agendamento são arredondados para cima.

## Correção

Deixar o próprio tick continuar dentro da mesma execução quando o delay é curto, em vez de devolver o controle ao agendador de 10s:

- Depois de enviar um item, se o próximo delay sorteado for curto (até ~25s), a função aguarda exatamente esse tempo e envia o próximo item da mesma campanha, respeitando o sorteio 10–15s ao milissegundo.
- Limite de tempo por execução (~2 minutos) e checagem de status/pausa antes de cada envio: se a campanha for pausada ou cancelada, para imediatamente.
- Ao sair, agenda `proximo_em` normalmente e libera a trava do worker, como hoje.
- Delays longos (ex.: 30–90s) continuam como hoje, devolvendo ao agendador — sem custo extra.

Efeito prático nesta campanha: ritmo passa de ~20s para ~12,5s médios, e a previsão de término cai de ~4h27 para ~2h40 nos 751 restantes.

## Aviso de custo (Lovable Cloud)

Essa mudança **não cria** novo cron, nova tabela nem novo polling. Ela mantém o mesmo número de execuções agendadas, mas cada execução passa a ficar ativa mais tempo (aguardando os 10–15s entre envios), o que aumenta o tempo de CPU/memória faturado das campanhas com delay curto.

Estimativa: para uma campanha de 881 contatos com delay 10–15s, o tempo de função ativa sai de ~poucos segundos por envio para o tempo total da campanha (~2h40 de função em espera, em blocos de ~2min). Impacto mensal depende do volume de campanhas com delay curto; é um aumento modesto, mas real.

Alternativa sem esse aumento: baixar a granularidade do agendamento (ex.: a cada 5s) — melhora o erro de 20s para ~15s, mas **não** garante o 10–15s exato e aumenta o número de execuções ociosas. Não recomendo.

## Detalhes técnicos

- `supabase/functions/envio-meta-massa-tick/index.ts`: no bloco `Deno.serve`, quando `processarItem` retorna `advanced` com `delayMs <= 25000`, entrar em laço interno com `await sleep(delayMs)` + re-leitura do job (status `rodando`) + novo `processarItem`, respeitando orçamento total de execução (~120s) e renovando `worker_locked_until` durante o laço.
- Sem alteração de schema, sem alteração de cron, sem alteração de frontend (a previsão de término já é calculada pelo ritmo real e vai se ajustar sozinha).
