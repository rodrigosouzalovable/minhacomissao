# Google Maps Leads: identificar empresas sem site

Boa notícia: o dado já vem do Google na busca (campo `websiteUri`) e já é gravado na coluna `site` de cada lead — só não aparece na tela. Não há custo extra nem nova chamada ao Google.

## O que muda na tela

- Nova coluna **Site**: link clicável quando existe, ou badge cinza **"Sem site"** quando não existe.
- Contadores no topo: **X com site / Y sem site** (junto dos contadores de WhatsApp).
- Novo filtro rápido **"Só sem site"**, combinável com "Só com telefone" e "Só com WhatsApp" — esse é o filtro do seu projeto: sem site + com WhatsApp confirmado.
- **Exportar Excel** respeita os filtros e ganha a coluna Site; e um botão **"Exportar prospecção (sem site)"** que gera planilha só com Nome + Telefone + Categoria dos leads sem site e com WhatsApp.
- "Copiar telefones" continua respeitando os filtros ativos.

## Detalhes técnicos

- Apenas `src/pages/GoogleMapsLeads.tsx` (frontend): estado `somenteSemSite`, derivações de contagem sobre `leadsBase`, coluna Site na tabela, ajuste de `exportarExcel()` e novo `exportarProspeccao()`.
- Nenhuma migração e nenhuma mudança nas edge functions — `google-maps-buscar-leads` já persiste `site`.
- Observação: o Google só marca site quando há site cadastrado na ficha; alguns negócios usam link de Instagram/Facebook nesse campo. Vale tratar links de redes sociais como "sem site próprio" (badge amarelo "Só rede social") para não perder oportunidade — incluído no plano.

## Sobre a ideia de negócio (opinião)

Faz sentido e é um dos nichos de prospecção mais clássicos que funcionam:

- **A dor é real e visível**: quem não tem site perde busca no Google e credibilidade. O argumento de venda é direto.
- **R$ 500 é atrativo para fechar rápido**, mas cuidado com o pós-venda: hospedagem, domínio, alterações e suporte podem consumir a margem. Sugestão: R$ 500 de setup + uma mensalidade pequena (R$ 49–99) cobrindo hospedagem/domínio/ajustes — é o que transforma isso em receita recorrente em vez de venda avulsa.
- **Priorize nichos com ticket alto e dependência de imagem**: clínicas, odontologia, estética, advocacia, arquitetura, academias, pet shops, buffet/eventos. Evite nichos de rua muito informais, que fecham menos.
- **Use como filtro de qualidade** os dados que a busca já traz: nota e número de avaliações. Empresa sem site mas com 50+ avaliações e nota boa é negócio ativo e com dinheiro — melhor lead da lista.
- **Regra prática**: mensagem curta com prova (mostre um site modelo do mesmo nicho pronto antes de vender). Conversão sobe muito quando a pessoa vê o site dela quase pronto.
- **Respeite as regras de disparo já usadas no sistema** (round-robin, delays, blacklist) para não queimar os números.

Se quiser, depois posso criar uma aba de prospecção com etapas (a contatar / contatado / proposta / vendido) usando esses leads.
