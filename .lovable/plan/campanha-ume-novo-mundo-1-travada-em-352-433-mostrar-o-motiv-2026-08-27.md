# Campanha "UME + NOVO MUNDO 1" travada em 352/433 — mostrar o motivo e voltar a enviar

## O que realmente aconteceu (confirmado no banco)

O último envio dessa campanha foi às **12:00 BRT**. Desde então nada saiu. O job está gravado com:

- status: `erro`
- motivo: `Nenhuma instância disponível — SOUZA 62 8269-9503: teto diário atingido (50/40) | ... 8270-2349: teto diário atingido (108/10) | ...` (as 12 instâncias da campanha, todas estouradas)
- 352 enviados, 81 pendentes, 0 erros

Ou seja: **as 12 instâncias selecionadas bateram o teto diário**. Os tetos do dia estão baixos porque o freio de qualidade cortou 50% de alguns números (ex.: 8270-2349 com teto 10 e 106 enviados hoje; 8269-3506 com teto 10 e 65 enviados) e outros estão em fase inicial de rampa (teto 15/20/40). Nenhuma sobra de cota → o disparo para.

Por que você não viu o motivo na tela:

1. O painel de detalhe da campanha, ao atualizar, lê só os contadores e **preserva de propósito o status e o motivo** — então o selo continuou "Rodando".
2. Existe uma **auto-retomada a cada 60s** no front-end: sempre que o job cai em `erro` com pendentes, ele é reativado silenciosamente; o worker tenta, não acha instância, grava `erro` de novo. Esse vai-e-volta invisível rodou por ~4 horas sem mostrar nada.

## O que será corrigido

1. **Motivo visível na tela**
   - Ao atualizar, o diálogo passa a ler também `status` e `status_motivo` reais.
   - Novo aviso destacado no topo do detalhe quando a campanha está parada por indisponibilidade: "Parada: todas as instâncias atingiram o teto diário" + lista legível de cada número com `enviados/teto` e, quando houver, o motivo do corte de qualidade.
   - Selo passa a mostrar **Aguardando cota** (âmbar) em vez de "Rodando" nesse caso.

2. **Fim do loop invisível de reativação**
   - A auto-retomada deixa de disparar quando o motivo é teto diário/quarentena/qualidade. Nesses casos a campanha fica em estado de espera explícito, com o horário da próxima tentativa na tela.
   - Para os demais erros transitórios, mantém a retomada automática, mas com no máximo 3 tentativas e registro visível ("retomada automática às HH:MM — tentativa 2/3").

3. **Retomada automática no momento certo (em vez de "erro")**
   - Quando o bloqueio for só de cota diária, o worker não encerra mais o job como `erro`: mantém `rodando` com `proximo_em` na **próxima janela útil** (reavalia em 30 min dentro do dia, e às 08:00 BRT do próximo dia útil se o dia acabou). Assim os 81 pendentes saem sozinhos amanhã cedo, sem você reativar nada.
   - Aviso único no WhatsApp admin quando uma campanha entra nesse estado de espera (usa o remetente centralizado atual, uma mensagem por campanha/dia).

4. **Ação imediata para hoje**
   - Botão "Adicionar instâncias com cota livre" no aviso: lista os números do mesmo credor que ainda têm folga hoje (há instâncias com teto 80/200 e uso zerado) e os inclui na campanha em execução, retomando o envio no mesmo instante.

## Detalhes técnicos

- `supabase/functions/envio-meta-massa-tick/index.ts`: em `encerrarJobSemDisponibilidade`, distinguir bloqueio **temporário** (teto diário / freio / quarentena / rate limit) de bloqueio **definitivo** (nenhuma instância válida no job). Temporário → `status: 'rodando'`, `status_motivo` prefixado `AGUARDANDO_COTA:<retomaISO>:<detalhe>`, `proximo_em` = min(agora+30min, 08:00 BRT do próximo dia útil). Definitivo → mantém `erro`.
- `src/contexts/EnvioMetaSendingContext.tsx`: `refreshCountersJob` volta a ler `status, status_motivo`; auto-retomada ganha guarda por motivo (`/teto di|cota|quarentena|qualidade|AGUARDANDO_COTA/i`) e contador de tentativas por job.
- `src/components/meta/CampanhaDetalheDialog.tsx`: parser de `AGUARDANDO_COTA:` (igual ao já existente `RATE_LIMIT:`), banner âmbar com lista de instâncias/tetos, selo "Aguardando cota", contagem para a próxima tentativa e botão de adicionar instâncias com folga.
- Cotas exibidas vêm de `meta_instance_freio_diario` (dia BRT) + `meta_whatsapp_instances` (fase/tier), sem nova consulta pesada: uma leitura só quando o banner aparece.
- Impacto de custo: **reduz** carga — elimina a reativação a cada 60s (que gerava chamadas de função e escritas no job em loop) e substitui por espera agendada.
