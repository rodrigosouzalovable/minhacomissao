# Abrir conversas do Inbox Meta instantaneamente

## Causa confirmada

Ao clicar em uma conversa, o sistema faz uma consulta pesada nas mensagens:

- O filtro por telefone usa "termina com" (`ilike %8 dígitos`), que **não** usa o índice existente `(instancia_id, phone_suffix8(telefone))`. Medido no banco: a consulta lê todas as mensagens da instância e leva ~110 ms só no banco, mesmo devolvendo 0 linhas — e piora conforme a instância acumula mensagens.
- Junto com os dados, é pedida uma **contagem exata** de todas as mensagens da conversa (segundo trabalho pesado na mesma chamada).
- São carregadas **200 mensagens de uma vez** e **todas as colunas** (`select *`), incluindo campos grandes de mídia/citação/payloads.
- Nada fica em cache: reabrir a mesma conversa refaz a consulta inteira do zero.

## O que será feito

1. **Consulta alinhada ao índice**
   Passar a filtrar pelo sufixo de 8 dígitos de forma indexada (função no banco que recebe instância + sufixo e devolve a página de mensagens), eliminando a varredura da instância inteira.

2. **Fim da contagem exata**
   Deixar de pedir o total de mensagens. O botão/scroll "carregar anteriores" passa a se basear no tamanho da página retornada (se veio página cheia, existe mais).

3. **Primeira página menor**
   Abrir a conversa com as últimas 40 mensagens (em vez de 200) e continuar carregando as anteriores no scroll, em lotes de 40.

4. **Somente as colunas usadas**
   Selecionar apenas os campos que a tela renderiza, em vez de `select *`.

5. **Cache em memória por conversa (abertura instantânea)**
   Guardar as mensagens já carregadas de cada conversa na sessão. Ao clicar de novo, as mensagens aparecem na hora (0 ms) e o sistema revalida em segundo plano, atualizando se algo mudou. O Realtime já mantém o cache em dia enquanto a conversa está aberta.

6. **Feedback imediato ao clicar**
   O cabeçalho do chat (nome, telefone, etiquetas, botões) e um esqueleto de mensagens aparecem imediatamente, sem tela em branco, enquanto a primeira carga chega.

Também será pré-carregada em segundo plano a conversa do topo da lista, para o caso mais comum (abrir a mais recente) ser instantâneo.

## Detalhes técnicos

- Migração: `CREATE OR REPLACE FUNCTION public.meta_mensagens_thread(_instancia uuid, _suffix text, _limit int, _offset int)` — `SECURITY INVOKER`, `STABLE`, `SET search_path = public`, filtrando `instancia_id = _instancia AND phone_suffix8(telefone) = _suffix AND NOT apagada_para_mim`, `ORDER BY timestamp_msg DESC`, com `LIMIT/OFFSET`; retorna somente as colunas usadas pela UI. `GRANT EXECUTE` para `authenticated` (RLS das mensagens continua valendo por ser invoker).
- `src/pages/InboxMeta.tsx`: `fetchMensagens` passa a chamar a RPC; `PAGE_SIZE` 200 → 40; remove `{ count: 'exact' }` e deriva `temMaisAnteriores` de `lista.length === PAGE_SIZE`; novo `useRef<Map<string, MetaMensagem[]>>` como cache por `contato.id` (hidratação imediata + revalidação em background); skeleton enquanto `carregandoMsgs` sem cache; prefetch do primeiro contato da lista.
- Sem mudança de regra de negócio, de etiquetas, de fila de atendimento ou de retenção de conversas.
