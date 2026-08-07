# Todos os atendentes marcados na caixa entram na fila de atendimento

## Causa confirmada (verificada no banco e no código)

A caixa "Padrão" tem 6 responsáveis marcados: Anna Flavia, Fernanda, RODRIGO RIBEIRO DE SOUZA, Thailinny Nolasco, Wallace Maciel e Yasmim.

Todos os 6 já têm etiqueta "Atendente: <nome>" criada e registro **ativo** na fila (`meta_atendimento_fila`). O problema não é a fila.

O que bloqueia a Thailinny é um segundo filtro no webhook do Inbox Meta: além de ser responsável pela caixa, o usuário precisa ter a permissão global "Atende no Inbox Meta Oficial" ligada. No banco:

- Thailinny Nolasco → `atende_inbox_meta = false`
- RODRIGO RIBEIRO DE SOUZA → `atende_inbox_meta = false`
- Anna Flavia, Fernanda, Wallace, Yasmim → `true`

Ou seja, quando o cliente responde, o rodízio só sorteia entre os 4 com a permissão ligada — Thailinny nunca é sorteada, mesmo estando marcada na caixa.

## O que será feito

1. **Marcar na caixa passa a valer como habilitação de atendimento**
   - Ao marcar um operador como responsável de uma caixa (Padrão ou criada), o sistema liga automaticamente "Atende no Inbox Meta Oficial" para ele, além de garantir a etiqueta e o registro na fila (como já faz hoje).
   - Desmarcar da caixa continua apenas removendo o vínculo daquela caixa (não desliga a permissão global, para não afetar outras caixas).

2. **Correção retroativa dos responsáveis já marcados**
   - Ligar a permissão para todos os usuários atualmente vinculados a alguma caixa (Padrão ou criada) que estejam com ela desligada — resolve Thailinny e Rodrigo imediatamente, sem precisar remarcar nada na tela.

3. **Aviso visível no diálogo de atendentes**
   - O selo "fora da fila" passa a considerar também a permissão de atendimento, para que um caso desses fique evidente na hora.

4. **Regra de distribuição permanece a mesma**
   - Quando o cliente responde, a conversa recebe um único atendente, escolhido entre os responsáveis daquela caixa, sempre o de menor carga.

## Detalhes técnicos

- Migração: alterar `meta_provisionar_atendentes_fila(_folder uuid)` para, além de garantir `meta_whatsapp_etiquetas` + `meta_atendimento_fila`, fazer `UPDATE public.user_permissions SET atende_inbox_meta = true` (com `INSERT` da linha quando não existir) para cada membro da caixa. Executar um backfill único chamando a função para `null` (Padrão) e para cada `meta_inbox_folders.id`.
- `src/components/inbox/meta/MetaFolderAcessoDialog.tsx`: carregar `user_permissions.atende_inbox_meta` junto com a fila e exibir o selo quando o membro estiver fora da fila **ou** com a permissão desligada; chamar a RPC também no fluxo "Marcar todos".
- `supabase/functions/meta-whatsapp-webhook/index.ts`: nenhuma mudança de lógica necessária — com a permissão ligada, o filtro `etiquetaElegivel` já aceita os responsáveis da caixa.
