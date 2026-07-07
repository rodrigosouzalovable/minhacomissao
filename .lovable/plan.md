## Objetivo

Criar, na aba **Acordos da Equipe** e visível apenas para admin, um botão que abre um painel listando **acordos "abandonados"**: sem nenhuma parcela paga e com a **1ª parcela vencida há mais de 10 dias**. No painel, admin pode selecionar acordos (um a um ou "selecionar todos") e apagar em lote. Ao apagar, a dívida original volta a aparecer no portal de consulta por CPF (mesma regra do job automático).

## Comportamento

- **Botão "Acordos abandonados (10+ dias sem pagamento)"** no topo da página `EquipeAcordos`, renderizado só quando `isAdmin === true`. Mostra um badge com a contagem.
- Ao clicar, abre um **Dialog** com:
  - Título + explicação curta ("Acordos sem nenhuma parcela paga cuja 1ª parcela venceu há mais de 10 dias").
  - Checkbox "Selecionar todos" no cabeçalho.
  - Lista de acordos com: checkbox, nome do cliente, CPF, funcionário que lançou, data de criação, 1ª parcela (data + dias em atraso), valor total, nº de parcelas.
  - Botão **"Excluir selecionados"** (destrutivo), desabilitado quando nenhum está marcado. Mostra confirmação antes de executar.
  - Estado vazio: "Nenhum acordo abandonado encontrado."
- Após excluir:
  - Remove `pagamentos` e depois `acordos` desses IDs.
  - Reativa `devedores.ativo = true` para todas as linhas com CPF igual ao do acordo e `ativo = false` (mesma lógica já implantada no job `cleanup-acordos`).
  - Recarrega a lista, atualiza contagem, mostra toast com quantidade excluída e quantos CPFs tiveram dívida reativada.

## Regras de seleção dos acordos

Um acordo entra na lista se **todas** as condições valem:
1. `acordos.status = 'ativo'`.
2. **Nenhuma** linha em `pagamentos` para esse acordo tem `status = 'pago'`.
3. A parcela de menor `data_prevista` do acordo tem `data_prevista < hoje - 10 dias`.

Sem filtro por funcionário — admin vê tudo (é o mesmo critério do job automático diário).

## Escopo técnico

Arquivo(s):
- `src/pages/EquipeAcordos.tsx` — adiciona botão no header (dentro do bloco `{isAdmin && …}` existente) e monta o Dialog. Nova consulta React Query `['acordos-abandonados']` que:
  1. Busca `acordos` `status='ativo'` (`id, cliente_cpf, cliente_nome, user_id, valor_total, parcelas, criado_em`).
  2. Para cada um (em lotes/`.in()`), consulta `pagamentos` para achar `min(data_prevista)` e verificar se existe alguma paga.
  3. Filtra os que passam nos 3 critérios.
  4. Junta com `profiles` para exibir nome do funcionário.
- Ação de exclusão em lote roda direto no cliente com o client Supabase (admin, então RLS já permite): `delete pagamentos in (ids)` → `delete acordos in (ids)` → para cada CPF único, `update devedores set ativo=true where cpf_normalize(cpf) = X and ativo=false`. Já existe policy admin para essas 3 tabelas.
- Sem migration, sem edge function nova, sem mudança no `cleanup-acordos`.

## Fora de escopo

- Não muda o job automático `cleanup-acordos` (10 dias já é a regra atual dele).
- Não altera portal público, telas de funcionário, RLS, nem esquema.
- Não faz "quebrar acordo" — este painel é só para exclusão + retorno à dívida original, como o próprio job.
