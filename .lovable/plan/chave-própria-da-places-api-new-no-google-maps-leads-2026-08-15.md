# Chave própria da Places API (New) no Google Maps Leads

## O que muda na tela

Novo card "Chave da Places API (New)" no topo da página Google Maps Leads (visível só para admin):

- Campo de senha para colar a chave, botão "Salvar chave" e botão "Testar chave".
- Indicador de status: "Chave própria configurada" (mostrando só os 4 últimos caracteres) ou "Usando conexão padrão do Lovable".
- Botão "Remover chave" para voltar à conexão padrão.
- O "Testar chave" faz uma busca mínima real e mostra em texto claro o motivo caso o Google recuse (API não habilitada, restrição de IP, restrição de referrer).

Importante: a chave nunca é devolvida para a tela depois de salva — só o status e os últimos dígitos.

## Como a busca passa a funcionar

Se houver chave própria salva, a busca chama a Places API (New) direto no Google com essa chave, sem passar pela conexão padrão. Se não houver, continua usando o caminho atual. O contador mensal, bloqueio em 4800 consultas e gravação de leads seguem iguais.

Observação: para uma chave usada no backend, ela precisa ter "Restrições de aplicativo = Nenhuma" (ou IPs liberados) e a Places API (New) permitida — o teste da tela aponta exatamente qual desses falta.

## Detalhes técnicos

- Guardar a chave como secret do backend (`GOOGLE_PLACES_API_KEY_OWN`), gravado por uma nova edge function `google-maps-salvar-chave` (admin-only via `has_role`), usando a API de secrets do projeto. Nenhuma chave em tabela ou no frontend.
  - Alternativa se a gravação por function não for viável: tabela `google_maps_config` (RLS admin-only, sem SELECT do valor via API; leitura apenas por service_role nas functions).
- Nova edge function `google-maps-status-chave`: retorna `{ tem_chave: boolean, sufixo: string | null }` (admin-only).
- Nova edge function `google-maps-testar-chave`: chama `places.googleapis.com/v1/places:searchText` com `pageSize: 1` e reaproveita o parser de erro 403 já existente.
- `google-maps-buscar-leads`: se a chave própria existir, trocar o alvo do fetch para `https://places.googleapis.com` com header `X-Goog-Api-Key`, mantendo o mesmo `X-Goog-FieldMask`, paginação e tratamento de erros; senão, manter o gateway atual.
- `src/pages/GoogleMapsLeads.tsx`: novo componente de card com React Query para status, mutations de salvar/testar/remover e toasts.

## Custo

Sem cron, sem polling e sem tabela nova pesada. A única chamada extra é o "Testar chave", disparada manualmente (1 consulta Places).
