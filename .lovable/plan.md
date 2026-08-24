# Agendar campanha com data e hora (aba Envio Meta)

## O que muda na tela

O bloco de agendamento atual ("Agendar campanha multi-dia", com distribuição por cota diária ao longo de vários dias) é substituído por um agendamento simples de data e hora:

- Título passa a ser apenas **"Agendar campanha"**.
- No lugar da caixa de seleção, um **botão de ativar/desativar (switch)**: "Agendar em vez de disparar agora".
- Ao ativar, abre um campo de **data** (calendário) e um campo de **hora** (HH:MM), com valores padrão sugeridos (amanhã, 08:00 BRT). Também segue disponível o campo opcional de nome da campanha.
- O botão principal na parte de baixo da página deixa de ser **"Disparar"** e passa a ser **"Agendar (N)"** enquanto o agendamento estiver ativo.
- Ao clicar em "Agendar", o sistema valida (template, instâncias, destinatários, data/hora no futuro), registra a campanha e mostra: "Campanha agendada para 25/08/2026 às 09:00 — acompanhe no botão Campanhas".
- A campanha agendada aparece na lista de campanhas (mesmo painel flutuante de hoje) com o rótulo "Agendada para dd/MM às HH:MM" e pode ser pausada/cancelada como qualquer outra.
- Nada é enviado antes do horário; ao chegar a data/hora, o motor de envio inicia sozinho e respeita a janela de envio (08h–19h BRT, sem domingos). Se o horário escolhido cair fora da janela, avisamos na hora de agendar que o início será na próxima abertura.

## Detalhes técnicos

- `src/components/meta/CampanhaAgendadaSection.tsx`: `AgendarCampanhaBox` é reescrito — remove `calcularPlano`/tabela de distribuição multi-dia e a gravação em `meta_campanha_agendada`/`meta_campanha_item`. Passa a expor apenas o estado (`ativo`, `dataHora`, `nome`) para a página via props de callback (`onChange`), sem botão próprio de confirmação. `CampanhasAgendadasList` é removida da página (o painel de campanhas já cobre isso).
- `src/pages/EnvioMeta.tsx`: mantém o estado do agendamento; o botão de disparo troca rótulo/ícone quando `agendamentoAtivo` e envia `agendarPara` (ISO UTC calculado a partir de data+hora locais) para `iniciar(...)`. Confirmação (`confirm`) passa a citar data/hora em vez de "disparar agora".
- `src/contexts/EnvioMetaSendingContext.tsx`: `IniciarParams` ganha `agendarPara?: string | null`; repassado no corpo da chamada da função de início. Job agendado não abre o painel de progresso ativo — só entra na lista.
- `supabase/functions/envio-meta-massa-iniciar/index.ts`: aceita `agendarPara`; quando presente e no futuro, grava o job com `proximo_em = agendarPara` (ajustado para a abertura da janela se cair fora), `status_motivo = "Agendada para <dd/MM HH:MM> BRT"` e **não** dispara o tick imediato nem os workers de rajada. O motor existente (`envio_meta_claim_due_job` só pega jobs `rodando` com `proximo_em` vencido) faz o início automático no momento certo, sem cron novo.
- Sem novas tabelas, crons, polling ou canais Realtime — nenhum aumento de custo no Cloud.
