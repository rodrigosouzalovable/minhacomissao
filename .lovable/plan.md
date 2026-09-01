# Status DNS na aba Domínios

## Situação atual (verificada agora)

O subdomínio `luizcarlos.meusacordos.com.br` está com os dois registros corretos e publicamente visíveis:

- A → `185.158.133.1` (ok)
- TXT `_lovable.luizcarlos.meusacordos.com.br` → `lovable_verify=c0376db0…7b7cbe` (ok)

O status na Lovable segue "initiated" (setup iniciado, não concluído) há ~50 min. Não há nada errado no DNS nem no código: falta concluir o fluxo em Configurações do Projeto → Domínios (**Complete setup** / Check status). O "Domain Service Error" do print impede essa conclusão — recarregar a página antes de clicar resolve.

## O que vou construir

Um verificador de DNS dentro da própria aba Domínios, para você saber na hora se os registros já propagaram sem depender do painel:

1. Botão **Verificar DNS** em cada subdomínio cadastrado.
2. Resultado em duas linhas com selo verde/vermelho:
   - Registro A: valor esperado × valor encontrado publicamente
   - Registro TXT `_lovable.<prefixo>`: valor esperado × valor encontrado
   - Se houver TXT da Meta cadastrado, verifica esse também.
3. Mensagem final clara: "Registros propagados — conclua em Configurações do Projeto → Domínios" ou "Ainda não propagado / valor divergente", com o que precisa ser corrigido no registro.br.
4. Selo de última verificação com horário, e botão para repetir.

Sem verificação automática em segundo plano — a checagem roda só quando você clica, para não gerar custo recorrente.

## Detalhes técnicos

- Nova edge function `dns-check` (pública, sem JWT): recebe `hostname` e os valores esperados, consulta DNS-over-HTTPS (`https://dns.google/resolve` com fallback `cloudflare-dns.com/dns-query`) para os tipos A e TXT, e retorna `{ registros: [{ tipo, nome, esperado, encontrado[], ok }] }`. Sem banco, sem cache, sem cron.
- `src/pages/AdminDominios.tsx`: botão + estado local por linha, chamada via `supabase.functions.invoke('dns-check')`, exibição dos selos no painel de instruções já existente. Nenhuma query nova ao banco.
- Sem alterações de schema, de portal público ou de regras de negócio.

## Custo

Impacto praticamente nulo: uma invocação de edge function por clique manual, sem cron, sem polling e sem escrita no banco.
