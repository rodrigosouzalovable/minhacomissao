# Corrigir selo "fora da fila" para o parceiro Thiago Nogueira

## O que foi verificado no banco

Os atendentes que o Thiago marcou nas caixas dele **já estão na fila de rodízio corretamente**:

| Caixa | Atendentes marcados | Na fila (ativo) | Permissão de atendimento |
|---|---|---|---|
| ODRES | Andreia, Bruno, Cacilda, Diego, Lorena, Marcia | sim (todos) | ativa (todos) |
| AMARAL NM | Lais, Poliana, Gabriel, Thiago | sim (todos) | ativa (todos) |
| AQUECIMENTO AMARAL | Thiago | sim | ativa |

Ou seja, o rodízio funciona — o problema é só o **aviso na tela**, que está mentindo.

Causa: o diálogo de atendentes lê direto as tabelas de fila e de permissões. A leitura da fila é liberada apenas para admin ou para quem pertence à empresa (tenant) das linhas; o Thiago não é admin e não tem vínculo de tenant, então a consulta volta vazia e o sistema conclui que "ninguém está na fila", marcando todos com o selo amarelo "fora da fila". A permissão global também não é legível por ele (só vê a própria linha).

## O que será feito

1. Criar uma consulta segura no servidor que devolve, para uma caixa específica, quais responsáveis estão de fato na fila e com permissão de atendimento ativa — acessível a quem pode gerenciar aquela caixa (admin, dono da caixa ou admin da caixa).
2. O diálogo "Atendentes da caixa" passa a usar essa consulta em vez de ler as tabelas diretamente. Assim o selo "fora da fila" só aparece quando o atendente realmente está fora.
3. Ao marcar um atendente, continua sendo feito o provisionamento (etiqueta + entrada na fila + permissão de atendimento) e o status é recarregado imediatamente pela nova consulta.

Nenhuma mudança nas regras de rodízio, nas permissões de acesso às caixas ou no isolamento do parceiro.

## Detalhes técnicos

- Migração: nova função `public.meta_fila_status_caixa(_folder uuid)` `SECURITY DEFINER STABLE`, retornando `user_id uuid, na_fila boolean`. Corpo: membros de `meta_inbox_folder_members` (ou `meta_inbox_default_members` quando `_folder IS NULL`), com `na_fila` = existe linha ativa em `meta_atendimento_fila` casada pela etiqueta `'Atendente: '||profiles.nome` **e** `user_permissions.atende_inbox_meta = true`. Guarda de autorização: `meta_inbox_folder_can_manage(auth.uid(), _folder)` para caixa criada; para a Padrão, `meta_inbox_default_can_manage(auth.uid())`. `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO authenticated`.
- `src/components/inbox/meta/MetaFolderAcessoDialog.tsx`: `loadFila` passa a chamar `supabase.rpc('meta_fila_status_caixa', { _folder: folderId })` e monta `naFila` a partir de `na_fila = true`, removendo as leituras diretas de `meta_atendimento_fila` e `user_permissions`.
