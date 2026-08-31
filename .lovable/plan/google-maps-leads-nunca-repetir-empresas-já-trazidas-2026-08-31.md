# Google Maps Leads: nunca repetir empresas já trazidas

## O problema

Hoje cada busca grava tudo o que o Google devolve, sem comparar com as buscas anteriores. Como o Google sempre devolve os mesmos resultados mais relevantes para "condomínio em Goiânia", a busca de 60 repetiu quase toda a lista de 30.

Importante: o Google (Places API) devolve no máximo 60 resultados por consulta de texto. Para achar empresas novas além dessas 60, é preciso variar a consulta — não existe "página 4".

## O que muda na tela

- Novo interruptor no card "Nova busca": **"Trazer somente empresas novas"** (ligado por padrão).
- Ao terminar a busca, o resumo passa a mostrar: **"42 novas • 18 já existiam (ignoradas)"**.
- Quando o sistema não conseguir completar a quantidade pedida só com empresas novas, aparece um aviso explicando que o Google esgotou os resultados para aquele termo e sugerindo variar o nicho ou a localização (ex.: bairro em vez de cidade).
- Buscas antigas continuam intactas.

## Como a busca passa a funcionar

1. Antes de gravar, o sistema carrega os identificadores (place_id) de todas as empresas já trazidas em buscas anteriores suas.
2. Empresas repetidas são descartadas e contabilizadas — não entram na nova lista.
3. Se depois de descartar as repetidas a lista ficar menor do que a quantidade pedida, o sistema continua paginando até o limite do Google (3 páginas) e, se ainda faltar, executa até 3 variações automáticas da consulta (ex.: "condomínio Goiânia GO", "condomínios residenciais em Goiânia", "condomínio fechado Goiânia") para descobrir empresas diferentes. Cada variação é uma consulta paga a mais e só é disparada se realmente faltar lead novo.
4. Empresa sem place_id é comparada por nome + telefone como segurança.

## Detalhes técnicos

- Migração: índice único em `google_maps_leads (user_id, place_id)` (parcial, `place_id is not null`) e inserção com `upsert ... ignoreDuplicates` para blindar contra corrida.
- `supabase/functions/google-maps-buscar-leads/index.ts`:
  - novo campo no body: `somente_novos` (default `true`) e `max_variacoes` (default 3);
  - carrega `place_id` existentes do usuário (select paginado em `google_maps_leads`) para um `Set`;
  - filtra `collected` por esse Set + dedup interno da própria resposta;
  - loop de variações de `textQuery` gerado a partir de categoria/localização, respeitando o guardrail `gm_status_uso` / `gm_incrementar_uso` a cada requisição;
  - retorna `total`, `novos`, `ignorados_duplicados`, `esgotou_resultados`, `variacoes_usadas`.
- `src/pages/GoogleMapsLeads.tsx`: interruptor "Trazer somente empresas novas", envio do parâmetro e toasts/badges com os novos contadores.

## Aviso de custo (Lovable Cloud / Google)

Sem cron, polling ou Realtime novos. O custo só sobe quando faltam leads novos: cada variação de consulta é 1 requisição Text Search adicional (mesmo preço das páginas atuais), limitada a 3 por busca. O contador mensal e o bloqueio em 4800 consultas continuam valendo.
