# Instagram dos leads: mostrar os perfis que já foram encontrados

## O que aconteceu

A busca de Instagram **funcionou** — só não apareceu na tela. Verifiquei o banco:
o processo rodou às 00:17–00:19 e já achou perfis com seguidores reais
(ex.: corpobueno 111.701, almaclinica 32.157, esteticface 20.280). Hoje há
31 empresas com Instagram encontrado.

Motivo do "—" na tabela: a leitura dos sites e a consulta dos perfis rodam em
segundo plano depois da busca, levando 1–3 minutos. A tabela é carregada uma
única vez, no fim da busca, quando nenhum perfil estava pronto ainda — e não se
atualiza sozinha enquanto o trabalho continua.

Dois pontos secundários:
- Empresas sem site nunca entram na procura (o @ é achado lendo o site).
- Alguns perfis existem mas vêm sem seguidores por serem restritos/privados ou
  por terem trocado de @ ("não encontrado").

## O que vou fazer

1. **Atualização automática da tabela**: enquanto houver empresas com site ainda
   sem resultado de Instagram, a lista se recarrega a cada 10 segundos e para
   sozinha quando termina.
2. **Indicador de progresso** no topo: "Instagram: 31 de 60 verificados…" com
   sinal de carregando, para não parecer que a busca falhou.
3. **Cobrir empresas cujo "site" já é uma rede social** (link do Instagram,
   linktr.ee): ler esse link e extrair o @ dele.
4. **Explicar os casos sem seguidores**: quando o perfil foi achado mas o número
   não veio, mostrar um aviso discreto na linha ("perfil privado/restrito" ou
   "@ não encontrado") em vez de um traço vazio.
5. Ao terminar, o aviso final passa a informar quantos perfis vieram com
   seguidores, quantos ficaram sem e quantas empresas não tinham site.

## Detalhes técnicos

- `src/pages/GoogleMapsLeads.tsx`: `refetchInterval` condicional na query
  `gm-leads` (10s enquanto existirem leads com `site` e sem
  `instagram_atualizado_em`), contador de progresso, coluna Instagram/Seguidores
  exibindo o motivo vindo do cache.
- `supabase/functions/google-maps-instagram-enriquecer/index.ts`: aceitar `site`
  que seja link de rede social (instagram/linktr.ee) como fonte do @; retornar
  também `sem_site` e `sem_seguidores` no resumo; expor `erro` do perfil no lead
  (nova coluna `instagram_status` em `google_maps_leads`, via migração).
- Sem novo cron, polling ou custo recorrente: o refetch só roda durante o
  enriquecimento e para ao concluir.
