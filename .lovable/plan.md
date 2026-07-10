# Fix: 30+ notificações duplicadas de "Envio Meta concluído"

## Causa

O tick do envio Meta roda em várias invocações concorrentes. Quando o último item é processado, várias delas entram no bloco "sem pendentes" ao mesmo tempo e chamam `notificarConclusao(job.id, 'concluido')`.

A idempotência atual em `_shared/notificar-admin.ts` é `SELECT` → `INSERT`, sem constraint única. Como todas as chamadas rodam no mesmo segundo, o SELECT retorna vazio para todas antes de qualquer INSERT — e todas enviam a mensagem no WhatsApp. Foi exatamente o que aconteceu (30x no mesmo segundo).

O update de `envio_meta_job.status = 'concluido'` (linhas 142-148 de `envio-meta-massa-tick/index.ts`) também não é guardado por status atual, então não serve de trava.

## Correção (mínima, cirúrgica)

**Arquivo:** `supabase/functions/envio-meta-massa-tick/index.ts`

1. **Transição atômica de status** no bloco "sem pendentes" (linhas 141-151):
   - Trocar o `update(...).eq('id', job.id)` por `.eq('id', job.id).eq('status', 'rodando').select('id').maybeSingle()`.
   - Só chamar `notificarConclusao(job.id, 'concluido')` se o update devolveu uma linha (ou seja, esta invocação foi a única que ganhou a transição `rodando → concluido`). As demais concorrentes recebem `null` e retornam sem notificar.

2. **Mesma proteção em `encerrarJobSemDisponibilidade`** (linhas 46-56): trocar para `.eq('status', 'rodando').select('id').maybeSingle()` e só chamar `notificarConclusao(job.id, 'erro', motivo)` quando a transição ocorreu.

Isso resolve o problema na raiz (só um tick pode notificar por job) e não depende de mudança de schema.

## Fora de escopo

- Não alterar `_shared/notificar-admin.ts`, `admin_notificacoes_log`, RLS, nem outros callers de `notificarAdmin`.
- Não mexer em UI nem em regras de negócio de envio.

## Verificação

- Reprocessar mentalmente o cenário: N ticks concorrentes veem `pend = null`; todas tentam `UPDATE ... WHERE status='rodando'`; o Postgres serializa e apenas uma afeta linha; as outras seguem sem notificar.
- Lint/typecheck automático do harness após a edição.
