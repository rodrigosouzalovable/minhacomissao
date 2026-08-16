# Cota de disparos por BM (Business Manager)

O limite de disparos passa a ser controlado pela BM, não por WhatsApp. Cada BM recebe um tier (ex.: 2.000/24h) e todos os WhatsApps vinculados a ela compartilham esse mesmo saldo.

## Regras definidas

- Janela móvel de 24 horas (igual à Meta): conta os envios das últimas 24h a partir do momento atual.
- Consomem cota: disparos de campanha (Envio Meta / Lembrete Meta) e conversas iniciadas manualmente pelo botão "Nova conversa" do Inbox Meta Oficial (envios por template).
- Não consomem cota: mensagens trocadas dentro de uma conversa com janela de 24h já aberta.
- Ao atingir o limite, as instâncias daquela BM são retiradas da fila e o disparo continua pelas outras BMs disponíveis. Se nenhuma BM tiver saldo, o job pausa até a cota renovar.

## O que muda na tela "Oficial Meta"

- Cada BM ganha um campo de tier editável (250 / 1K / 2K / 10K / 100K / Ilimitado, com opção de valor personalizado).
- Ao lado de cada BM: uso das últimas 24h e saldo restante (ex.: "1.500 / 2.000 — 500 restantes"), com barra de progresso e destaque quando a cota estourar.
- O tier por instância deixa de ser o número que trava o envio: o card da instância passa a exibir o saldo da BM à qual pertence (mesmo número para todos os WhatsApps da mesma BM).

## O que muda na tela "Envio Meta"

- Em "Acessar instâncias", o contador ao lado de cada card mostra o consumo/saldo da BM (idêntico para todas as instâncias da mesma BM), não mais o contador individual.
- O cabeçalho de cada grupo de BM mostra "usadas / limite / restantes (24h)".
- Instâncias de BMs sem saldo aparecem bloqueadas, não são selecionadas automaticamente e são ignoradas no rodízio.
- Antes de iniciar um disparo, um aviso informa se o total selecionado excede o saldo somado das BMs envolvidas.

## Controle no servidor (a trava real)

O bloqueio é aplicado no backend, então vale para campanhas, rajada, lembretes e "Nova conversa" — não só na interface.

## Detalhes técnicos

1. Banco
   - `meta_business_managers`: nova coluna `tier_diario` (integer, default 1000) e `tier_ilimitado` (boolean, default false).
   - Índice em `meta_whatsapp_instances(meta_bm_id)` e em `meta_whatsapp_envios_log(instancia_id, criado_em)` para a contagem de 24h ficar rápida.
   - Nova função `meta_bm_uso_24h()` (security definer, retorna bm_id, nome, tier_diario, tier_ilimitado, enviados_24h, restantes) somando os registros de `meta_whatsapp_envios_log` com status enviado das últimas 24h, agrupados pela BM da instância. Só envios por template entram (é exatamente o que essa tabela registra hoje), o que já exclui as respostas dentro da janela aberta.

2. Backend
   - `send-whatsapp-meta`: antes de enviar, resolve a BM da instância e consulta o uso de 24h; se `enviados_24h >= tier_diario`, retorna 200 com `bm_quota_blocked: true` e o motivo, sem enviar.
   - `envio-meta-massa-tick` e `envio-meta-massa-burst`: ao receber `bm_quota_blocked`, adicionam todas as instâncias daquela BM em `instancias_bloqueadas_run` (não apenas a instância usada) e seguem com as demais; se sobrar nenhuma, o job pausa com motivo "cota da BM esgotada".
   - `pick-meta-instance`: passa a descartar instâncias cuja BM está sem saldo, com motivo explícito na lista de descartes.

3. Frontend
   - Novo hook `useBmCotas` (RPC `meta_bm_uso_24h`, `staleTime` alto + refetch manual/on-focus, com guard de visibilidade) usado por `ConfigurarMeta.tsx`, `BusinessManagersManager.tsx` e `EnvioMeta.tsx`, para que o mesmo número apareça em todas as abas.
   - `BusinessManagersManager.tsx`: edição do tier e exibição de uso/saldo.
   - `EnvioMeta.tsx`: badge por instância e cabeçalho de grupo passam a usar os dados da BM; bloqueio de seleção quando sem saldo.

## Aviso de custo (Lovable Cloud)

Este ajuste adiciona uma consulta agregada de 24h por envio no backend. Com os índices propostos o impacto é baixo, mas existe:
- +1 consulta leve por mensagem enviada (cacheável por instância dentro do mesmo tick);
- consulta agregada na interface apenas ao abrir as abas e em refresh manual (sem polling novo).
Nenhum cron, Realtime ou polling adicional será criado.
