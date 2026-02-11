

## Plano: Limpeza Automática de Acordos e Tag "ACORDO QUEBRADO"

### Regras de Negócio

1. **Acordo sem nenhuma parcela paga** -- Se passaram 30 dias do primeiro vencimento sem nenhuma parcela marcada como paga, o acordo e todas as suas parcelas sao excluidos automaticamente do sistema.

2. **Acordo com parcelas pagas** -- Se a proxima parcela pendente nao for marcada como paga em ate 30 dias apos seu vencimento:
   - Todas as parcelas pendentes (nao pagas) sao excluidas
   - O acordo recebe o status "quebrado"
   - A tag "ACORDO QUEBRADO" fica visivel no card do acordo

3. **Liberacao de CPF** -- Quando um acordo tem status "quebrado", qualquer funcionario pode lancar novo acordo com o mesmo CPF (essa logica ja existe parcialmente no sistema).

### Implementacao

#### 1. Migracoes SQL

**Atualizar a funcao `cpf_ultimo_acordo_quebrado`** para tambem considerar o novo status `quebrado` no campo `status` do acordo (alem da logica atual de 10 dias).

**Atualizar o trigger `acordos_block_duplicate_cpf`** para liberar CPFs com ultimo acordo em status `quebrado`.

#### 2. Nova Edge Function: `cleanup-acordos`

Funcao que roda diariamente (via cron) e executa:

**Passo 1 -- Excluir acordos sem pagamento:**
```sql
-- Encontrar acordos onde:
-- 1. Nenhuma parcela tem status 'pago'
-- 2. A data do primeiro vencimento (MIN data_prevista) foi ha mais de 30 dias
-- Deletar pagamentos e depois o acordo
```

**Passo 2 -- Quebrar acordos com parcelas atrasadas:**
```sql
-- Encontrar acordos onde:
-- 1. Tem pelo menos 1 parcela paga
-- 2. A proxima parcela pendente (MIN data_prevista WHERE status='pendente') esta vencida ha mais de 30 dias
-- Deletar todas as parcelas pendentes
-- Atualizar acordo.status = 'quebrado'
```

#### 3. Atualizar Frontend

**`Acordos.tsx`** -- Atualizar a logica de deteccao de "QUEBRA DE ACORDO" para tambem verificar `acordo.status === 'quebrado'` (alem da logica existente de 10 dias).

**`AcordoDetalhe.tsx`** -- Mesma atualizacao para exibir a tag quando status for "quebrado".

**`EquipeAcordos.tsx`** -- Mesma atualizacao.

#### 4. Cron Job

Agendar a edge function `cleanup-acordos` para rodar uma vez por dia (ex: 03:00 horario de Brasilia) usando `pg_cron` + `pg_net`.

### Detalhes Tecnicos

**Edge Function `cleanup-acordos`:**
- Usa `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` para acesso admin
- Consulta acordos com parcelas vencidas ha 30+ dias
- Exclui acordos sem pagamentos ou marca como "quebrado"
- Retorna log do que foi processado

**Mudanca no threshold:** A logica atual de "QUEBRA DE ACORDO" usa 10 dias como limite. Com essa mudanca, a acao automatica (exclusao/quebra) acontece aos 30 dias. A tag visual pode continuar aparecendo antes (aos 10 dias) como alerta, ou ser ajustada para 30 dias tambem.

**Arquivos modificados:**
- `supabase/functions/cleanup-acordos/index.ts` (novo)
- `src/pages/Acordos.tsx`
- `src/pages/AcordoDetalhe.tsx`
- `src/pages/EquipeAcordos.tsx`
- Nova migracao SQL (funcoes + cron job)

