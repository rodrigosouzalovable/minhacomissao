# Relatório diário dos leads do Google Maps + base completa na tela

## Situação de hoje (verificada)

- Base atual: 402 empresas captadas, 349 com telefone, 191 com WhatsApp confirmado, 38 já usadas no aquecimento, 60 captadas nas últimas 24h.
- O aquecimento já usa esses contatos (mistura de leads por instância) e os relatórios de 12h e 18h só citam o resgate de forma resumida.
- Não existe hoje nenhum relatório de fim de dia sobre os leads, nem uma tela onde você veja a base inteira captada.

## O que vou entregar

### 1. Relatório diário no seu WhatsApp (20h, só para 62991672674)

Um resumo enviado todo dia às 20h (nunca domingo) com:

- Leads captados hoje (e por nicho/cidade), total da base e quantos com telefone/WhatsApp confirmado.
- Quantos contatos ainda estão disponíveis para aquecimento (sem uso recente) — com aviso quando a lista estiver acabando.
- Reabastecimento automático: rodou hoje? quantas empresas novas entraram?
- Aquecimento com esses números: quantas mensagens foram disparadas hoje para leads do Maps, quantas entregues/lidas, quantas respostas e a taxa de resposta.
- Quais números (instâncias) estão em resgate/aquecimento usando os leads, e quem voltou ao volume normal.
- Melhores nichos do momento (ranking de resposta) e nichos bloqueados por não responderem.
- Diagnóstico em uma linha: "funcionando normalmente" ou o motivo exato de estar parado (fora de horário, sem leads, sem instância em aquecimento, bloqueio da Meta).

### 2. Base completa de leads na aba Google Maps Leads

Nova seção "Base de leads captados" com:

- Todos os leads já captados (não só a busca atual), com paginação.
- Colunas: empresa, telefone, WhatsApp confirmado, nicho, cidade, avaliação, site, Instagram/seguidores, data da captação, se já foi usada no aquecimento e se respondeu.
- Filtros por nicho, cidade, tem WhatsApp, já usado, respondeu, e busca por nome/telefone.
- Botão para baixar tudo (ou o filtro atual) em Excel.

## Detalhes técnicos

- Nova função `google-maps-leads-relatorio-diario`: agrega `google_maps_leads` (captação, pool disponível, respondedores), `meta_aquecimento_destino_log` filtrado por `origem='lead_maps'`/telefones de leads do dia, `meta_aquecimento_trilha` (resgate), `aquecimento_nicho_score` (ranking/bloqueios) e `google_maps_buscas`/`google_maps_uso_mensal` (reabastecimento). Envia por `_shared/notificar-admin.ts` (remetente fixo com failover), apenas para 62991672674.
- Cron novo `google-maps-leads-relatorio-20h` (23:00 UTC, seg–sáb). Custo: 1 execução/dia, sem polling novo — impacto desprezível.
- Frontend: nova seção em `src/pages/GoogleMapsLeads.tsx` consultando `google_maps_leads` com paginação server-side (range) e `count: 'exact'`, mais export via o `xlsx` já usado no arquivo. Sem realtime e sem refetch automático.
- Índices leves em `google_maps_leads` (created_at, nicho, tem_whatsapp) se ainda não existirem, para a paginação e o relatório não pesarem.
