# Mudar o ritmo com a campanha rodando + corrigir a previsão de término

## Sim, é possível mudar o tempo no meio da campanha

O motor de envio relê a configuração da campanha antes de cada mensagem. Então basta permitir a edição: a nova faixa passa a valer na mensagem seguinte, sem pausar, sem perder o que já foi enviado e sem repetir contato.

O que muda na tela: no bloco de previsão da campanha aparece "Alterar ritmo", abrindo um campo com mínimo e máximo em segundos (o atual vem preenchido: 5–10s). Ao salvar, a faixa nova entra em vigor no próximo envio e a previsão se recalcula.

## Por que a previsão está mostrando 221 horas

Conferi a campanha "UME + NOVO MUNDO 11" com os dados reais de envio:

- Os últimos 20 envios saíram com intervalo de **4,6s a 9,1s** — exatamente os 5–10s que você configurou.
- Mas nos primeiros minutos houve intervalos de 30s a 78s: 13 dos 34 contatos precisaram de 2 ou 3 tentativas (cada tentativa consome um intervalo inteiro) e 5 números saíram do rodízio por falha, um deles com "Business Account locked (#131031)".
- A previsão da tela divide **todo o tempo desde o início** pelo total processado. Como o começo foi muito lento, ela ficou em ~272s por mensagem e projetou 221 horas, apesar do ritmo atual ser ~7s.

Ou seja: o envio está no tempo certo; a previsão é que está sendo contaminada pelo início ruim.

## Correções

1. **Previsão pelo ritmo recente**: passa a usar a média dos últimos ~20 envios (e não a média desde o início). O rótulo fica "Ritmo (últimos envios)". Com o ritmo atual, a previsão dos ~2.900 restantes cai de 221h para cerca de 5h30.
2. **Alterar ritmo durante a campanha**, como descrito acima, com faixa entre 1s e 300s e mínimo nunca maior que o máximo.
3. **Destravar contato preso**: hoje um contato ficou parado em "processando" por causa do bloqueio da conta Meta. Passa a haver liberação automática de itens travados há mais de 5 minutos (volta para a fila ou vira erro, conforme as tentativas), para a fila não segurar o ritmo.
4. **Tentativas mais baratas**: quando a falha for da instância (não do contato), a nova tentativa em outra instância usa intervalo curto (1–2s) em vez de gastar o delay cheio, já que nenhuma mensagem foi entregue naquele contato ainda.

Observação: 5 dos 13 números já saíram desta campanha por falha, então o volume por hora também cai por isso. O número com conta bloqueada pela Meta (#131031) só volta quando a Meta liberar do lado deles.

## Aviso de custo (Lovable Cloud)

Não cria cron novo, tabela nova nem polling novo. A alteração de ritmo e a nova previsão usam as consultas que já existem. Reduzir o intervalo faz a campanha terminar mais rápido, o que tende a manter ou até diminuir o custo total de execução.

## Detalhes técnicos

- `supabase/functions/envio-meta-massa-control/index.ts`: nova ação `ajustar_delay` (valida 1–300s, `min<=max`, só dono/admin/parceiro do job) atualizando `min_seg`/`max_seg` em `envio_meta_job`.
- `src/components/meta/CampanhaDetalheDialog.tsx`: botão/inputs "Alterar ritmo" no bloco `eta`; ETA passa a calcular `segPorMsg` a partir dos `processado_em` dos últimos 20 itens `enviado` (consulta já feita para a lista de enviados), com fallback ao teórico quando houver menos de 5 amostras.
- `supabase/functions/envio-meta-massa-tick/index.ts`: watchdog que devolve itens `processando` com `updated_at`/reserva > 5 min; no caminho `podeReenfileirar`, `proximoEm` curto (1–2s) em vez de `delayUsuarioMs`.
- O laço interno já relê o job (`select('*')`) a cada iteração, então a faixa nova é aplicada sem redeploy nem reinício da campanha.
