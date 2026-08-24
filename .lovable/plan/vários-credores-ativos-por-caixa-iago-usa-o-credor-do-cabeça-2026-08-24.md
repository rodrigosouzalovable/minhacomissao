# Vários credores ativos por caixa + IAGO usa o credor do cabeçalho da conversa

## Como está hoje (verificado)

- Em "Configurar caixa" > "Credor da caixa", ativar um credor desativa automaticamente os outros: o código percorre os demais e marca `ativo = false`, e o banco tem um índice único que só permite **1 credor ativo por caixa**.
- O IAGO busca o credor da caixa com `ativo = true` (um único registro) e usa esse nome como credor oficial da negociação (também no follow-up).
- O cabeçalho da conversa já tem um seletor de credor por contato (Novo Mundo / UME, com logo), gravado em `meta_whatsapp_contatos.credor` como `novo_mundo` ou `ume`.
- A regra especial da calculadora UME no IAGO hoje depende do nome do credor da caixa conter "UME".

## O que muda

1. **Dois (ou mais) credores podem ficar ativos na mesma caixa**
   - Ao ligar um credor, os outros continuam como estão: nada é desativado automaticamente.
   - O texto da seção passa a explicar: quando houver mais de um credor ativo, o IAGO usa o credor marcado no cabeçalho da conversa.

2. **IAGO escolhe o credor pelo cabeçalho da conversa**
   - Se a conversa tem credor marcado no cabeçalho (Novo Mundo / UME), o IAGO usa esse credor — desde que ele esteja entre os credores ativos da caixa; a comparação é por nome normalizado (ignora acentos/maiúsculas, `novo_mundo` = "Novo Mundo", `ume` = "UME").
   - Se o cabeçalho não tem credor marcado:
     - só um credor ativo na caixa → usa esse;
     - mais de um ativo → o IAGO não afirma credor nenhum; se o cliente perguntar de qual débito se trata, pede a confirmação/CPF antes e nunca inventa credor.
   - Se o cabeçalho tem credor mas ele não está ativo na caixa, o credor do cabeçalho prevalece (é a informação mais específica daquela conversa).
   - Mesma regra aplicada no follow-up, para não trocar de credor no meio da conversa.

3. **Calculadora UME**
   - A consulta de descontos da UME passa a ser acionada quando o credor **resolvido** da conversa é UME (cabeçalho ou credor único da caixa), em vez de depender apenas do nome do credor da caixa.

## Detalhes técnicos

Banco (uma migração):
- Remover o índice único `meta_inbox_folder_credores_um_ativo_uk` (mantendo o índice único de nome por caixa).

Frontend:
- `src/components/inbox/meta/MetaFolderConfigDialog.tsx`: `alternarCredor` deixa de desativar os demais (apenas `update` do próprio registro); texto de ajuda atualizado.

Backend:
- Novo helper compartilhado (em `supabase/functions/_shared/iago.ts`) `resolverCredorConversa(supabase, folderId, contatoCredorSlug)`: carrega todos os credores ativos da caixa (`.eq('ativo', true)` sem `maybeSingle`), casa com o slug do contato por nome normalizado e devolve `{ nome, ambiguo }`.
- `supabase/functions/iago-atendimento/index.ts`: passa a selecionar também `credor` do contato, usa o helper para definir `credorCaixa`; quando `ambiguo`, não injeta a linha `Credor:` no prompt e adiciona instrução de não afirmar credor; `ehUme` passa a testar o credor resolvido.
- `supabase/functions/iago-followup-tick/index.ts`: mesma resolução de credor.
- `meta-whatsapp-webhook` não muda (só verifica se a caixa tem credor cadastrado).

Sem cron novo, sem polling novo, sem chamada extra de IA — apenas uma consulta leve já existente por atendimento.
