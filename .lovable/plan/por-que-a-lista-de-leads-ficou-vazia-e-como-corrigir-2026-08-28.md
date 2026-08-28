# Por que a lista de leads ficou vazia (e como corrigir)

## O que aconteceu

A busca "clínica veterinária / GOIANIA" trouxe 5 leads — e **todos os 5 têm site** (badge "5 com site / 0 sem site"). Como o filtro **"Só sem site"** estava marcado junto com **"Só com WhatsApp"**, os filtros eliminaram todos os resultados. A lista não está com defeito: ela está aplicando uma combinação de filtros que não sobra ninguém.

O problema real é de interface: a tela não deixa claro qual filtro zerou a lista, e o texto vazio ("Nenhum lead com telefone sem site nesta busca") não ajuda a desmarcar nada.

## Correção proposta

1. **Estado vazio explicativo e acionável**: quando a lista fica vazia mas a busca tem leads, mostrar quantos leads existem no total e qual filtro está cortando (ex.: "5 leads nesta busca, mas nenhum sem site"), com botão **"Limpar filtros"** que desmarca tudo e mostra os 5 leads.
2. **Contadores nos próprios filtros**: cada checkbox exibe quantos leads passariam por ele (ex.: "Só sem site (0)"), para o usuário ver antes de marcar.
3. **Filtro que zeraria a lista fica desabilitado** com aviso no tooltip, evitando marcar algo que resulta em zero.
4. **Badges de resumo clicáveis**: clicar em "0 sem site" / "2 com WhatsApp" aplica aquele filtro; clicar de novo remove.
5. **Padrão inicial mais seguro**: "Só sem site" e "Só com WhatsApp" começam desmarcados (hoje o usuário marcou; manter apenas "Só com telefone" como padrão), para a primeira visualização sempre mostrar resultados.

## Detalhes técnicos

- Somente `src/pages/GoogleMapsLeads.tsx` (frontend). Nenhuma migração, nenhuma mudança em edge functions, nenhuma chamada extra ao Google.
- Calcular, ao lado de `leadsFiltrados`, contagens por filtro individual sobre `leadsBase` para alimentar rótulos, tooltips e o estado `disabled`.
- Substituir o texto do estado vazio por um bloco que compara `leads.length` com `leadsFiltrados.length` e renderiza o botão "Limpar filtros" (reseta `somenteComWhats`, `somenteSemSite`, `ordenarPotencial` e opcionalmente `somenteComTel`).
