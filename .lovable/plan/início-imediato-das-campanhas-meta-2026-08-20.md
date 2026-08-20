# Início imediato das campanhas Meta

## O que aconteceu

A campanha "Lembrete Pag 20_08" foi iniciada às 08:58 BRT. A janela de envio configurada no pool Meta é **09h–19h BRT**, então o motor recebeu "Fora do horário (9h–19h BRT)" e reagendou o próximo envio com uma espera fixa de **10 minutos** (os 600s do contador). Isso é confirmado no job: `status_motivo = "Fora do horário (9h–19h BRT)"` e `proximo_em = 09:08 BRT`.

Ou seja: a espera não vem do clique em "Iniciar", vem do reagendamento fixo de 10 minutos quando o horário ainda não abriu — e ela continua valendo mesmo depois das 09:00, atrasando o disparo à toa.

## O que será feito

1. **Fim da espera fixa de 10 minutos.** Quando o bloqueio for de horário, o motor calcula exatamente quanto falta para a janela abrir e reagenda para esse instante (com no máximo 30s de checagem). Campanha iniciada 08:58 dispara às 09:00 em ponto; iniciada dentro da janela dispara imediatamente.
2. **Início imediato dentro da janela.** No arranque do job, se o horário já está liberado, o primeiro envio sai no primeiro tick sem nenhuma espera adicional (nada de delay antes da primeira mensagem).
3. **Aviso claro na tela** enquanto estiver fora da janela: em vez de "Próximo envio em 560s", mostrar "Aguardando abertura da janela de envio (09:00)" com a contagem real até a abertura.
4. **Valendo para todos** — a mudança é no motor de envio compartilhado, portanto vale para o seu login e para todos os parceiros Meta, tanto no modo normal quanto no modo rajada.

## Detalhes técnicos

- `supabase/functions/envio-meta-massa-tick/index.ts`: substituir os dois `const waitMs = 10 * 60_000` (bloqueio de `pick-meta-instance` e de `send-whatsapp-meta`) por um helper `esperaAteJanela()` que lê `meta_envio_pool_config` (`horario_inicio`, `horario_fim`, `bloquear_domingo`) e retorna os ms até a próxima abertura da janela em BRT, limitado a 30s quando a janela já está aberta.
- `supabase/functions/envio-meta-massa-burst/index.ts`: aplicar a mesma espera calculada nos pontos onde hoje há backoff longo por horário/domingo.
- `supabase/functions/envio-meta-massa-iniciar/index.ts`: manter `proximo_em = now()` e, se estiver fora da janela, já gravar `proximo_em` na abertura da janela + `status_motivo` explicativo, para o card mostrar a informação correta desde o início.
- `src/components/meta/CampanhaDetalheDialog.tsx` e `src/contexts/EnvioMetaSendingContext.tsx`: quando `status_motivo` indicar bloqueio de horário, exibir o texto de "aguardando abertura da janela" em lugar do "Próximo envio em Xs".
- Nenhuma mudança de schema, nenhum novo cron, nenhum polling adicional — sem impacto de custo.
