# Google Maps Leads + Instagram

Vamos evoluir a tela **Google Maps Leads** que já funciona, em vez de criar uma tela nova. Cada empresa encontrada passa a ter, quando possível, o Instagram, o número de seguidores e o site do perfil.

Observação importante: o campo de contatos/Instagram da Google não está disponível na chave pública do Places, então o Instagram será descoberto lendo o site da empresa (o link do perfil quase sempre está no site). Empresas sem site ficam sem Instagram.

## Como vai funcionar

1. Você busca por nicho e cidade como hoje (até 60 empresas por busca).
2. Uma nova caixa de seleção **"Buscar dados do Instagram"** enriquece o resultado.
3. Para cada empresa com site, o sistema abre o site, procura o link do Instagram e guarda o @usuário.
4. Com o @usuário, busca **seguidores** e **site do perfil**.
5. A tabela ganha três colunas novas: Instagram (link), Seguidores, Site do Instagram.
6. As exportações (CSV/Excel) e o envio para disparo continuam funcionando, já com as colunas novas.
7. Quem não achou nada aparece como "—".

Também vamos incluir no card de consumo do topo uma linha com o consumo do serviço de Instagram no mês, com alerta em 80%.

## Cache

Dados de Instagram já coletados valem por 30 dias. Dentro desse prazo, o sistema reusa o que está salvo e não gasta chamada nova.

## O que preciso de você

Um token da Apify (conta gratuita serve para testes). Vou pedir por um formulário seguro na hora de implementar. Sem ele, a busca de empresas continua igual e as colunas de Instagram ficam vazias com um aviso claro.

## Detalhes técnicos

Banco (migração):
- `google_maps_leads`: novas colunas `instagram_url`, `instagram_username`, `instagram_seguidores`, `instagram_site`, `instagram_atualizado_em`.
- Nova tabela `instagram_perfil_cache` (`username` PK, `seguidores`, `site`, `atualizado_em`, `erro`) com GRANTs para `authenticated` (SELECT) e `service_role` (ALL), RLS habilitada e política de leitura para usuários com `pode_google_maps_leads`.
- Nova tabela `apify_uso_mensal` (`mes_referencia`, `total_chamadas`, `limite`) + função `apify_incrementar_uso` / `apify_status_uso`, espelhando `gm_incrementar_uso`/`gm_status_uso`.

Edge Function nova `google-maps-instagram-enriquecer`:
- Entrada: `busca_id` ou lista de `lead_ids`.
- Valida sessão + `pode_google_maps_leads` (mesmo padrão de `verificar-limite-google-maps`).
- Para cada lead com `websiteUri`: fetch do HTML (timeout 8s, seguindo redirect) e regex para `instagram.com/<user>`, ignorando `p/`, `reel/`, `explore/`, `stories/`.
- Para cada username novo ou com cache > 30 dias: chama Apify `apify~instagram-profile-scraper` (run-sync-get-dataset-items) com `APIFY_API_TOKEN`, lê `followersCount` e `externalUrl`; grava no cache (inclusive erros, para não repetir).
- Concorrência limitada (3 por vez), teto de 60 leads por execução, incrementa `apify_uso_mensal` por chamada e bloqueia a 80%/limite configurado.
- Erros não-OK: log de status + corpo e retorno com `status` real e `corsHeaders` (perfil privado/inexistente → `erro` no cache e "—" na tela).

`supabase/functions/google-maps-buscar-leads/index.ts`:
- Aceita `enriquecer_instagram?: boolean` e, ao final da busca, dispara a nova função de forma assíncrona para a busca criada.

Frontend `src/pages/GoogleMapsLeads.tsx`:
- Checkbox "Buscar dados do Instagram" no formulário.
- 3 colunas novas na tabela (responsivas, truncadas no mobile), botão "Enriquecer Instagram" para leads já buscados.
- Card de consumo ganha linha da Apify (via `apify_status_uso`).
- Exportações CSV/Excel incluem as colunas novas; o envio para disparo Meta não muda de contrato.

Segredo necessário: `APIFY_API_TOKEN` (via formulário seguro). `GOOGLE_MAPS_API_KEY` e os limites do Google continuam como estão.
