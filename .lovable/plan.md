## Objetivo

Adicionar regra: **instâncias só entram na fila de aquecimento 5 dias após sua criação**. Antes disso, ficam aguardando (sem conversar com outros números).

## Implementação

### 1. Edge Function `whatsapp-aquecimento/index.ts`

**Auto-enrollment (linhas ~63-83):** ao auto-inscrever instâncias novas no aquecimento, criar com status `AGUARDANDO_MATURACAO` em vez de `EM_AQUECIMENTO` quando `criado_em` da instância tem menos de 5 dias.

```ts
const idadeDias = (Date.now() - new Date(inst.criado_em).getTime()) / 86400000;
const statusInicial = idadeDias < 5 ? "AGUARDANDO_MATURACAO" : "EM_AQUECIMENTO";
```

**Promoção automática (novo bloco, antes do "GET ALL WARMING INSTANCES"):** varrer instâncias com status `AGUARDANDO_MATURACAO` cuja instância principal já tem 5+ dias e promover para `EM_AQUECIMENTO`.

```sql
-- conceitualmente
UPDATE whatsapp_aquecimento_instancias
SET status = 'EM_AQUECIMENTO'
WHERE status = 'AGUARDANDO_MATURACAO'
  AND instancia_id IN (
    SELECT id FROM user_whatsapp_instances
    WHERE criado_em <= now() - interval '5 days'
  );
```

**Seleção para conversas (linha ~146):** já filtra por `IN ("EM_AQUECIMENTO","AQUECIDO")`, então `AGUARDANDO_MATURACAO` é naturalmente excluído. Sem mudança aqui.

### 2. Trigger `sync_instance_to_aquecimento` (DB function)

Atualizar para inserir como `AGUARDANDO_MATURACAO` quando a instância for nova (criado_em há menos de 5 dias). Mesma lógica do auto-enrollment, garantindo coerência quando uma instância é criada via UI.

### 3. UI — Dashboard de Aquecimento

Em `AquecimentoDashboard.tsx` (e/ou `GrupoAquecimentoCard.tsx`): exibir badge "Aguardando maturação (faltam X dias)" para instâncias com status `AGUARDANDO_MATURACAO`, calculando `5 - idadeDias` a partir de `criado_em`.

### 4. Edge function `add-to-warming-group`

Verificar se também respeita a regra (não adicionar ao grupo do WhatsApp instâncias com menos de 5 dias) — se adiciona, condicionar à mesma regra de idade.

## Arquivos afetados

- `supabase/functions/whatsapp-aquecimento/index.ts` — auto-enrollment + bloco de promoção
- `supabase/functions/add-to-warming-group/index.ts` — filtro de idade ≥ 5 dias
- Migração SQL — atualizar função `sync_instance_to_aquecimento`
- `src/components/aquecimento/AquecimentoDashboard.tsx` (ou `GrupoAquecimentoCard.tsx`) — badge de "aguardando maturação"

## Comportamento resultante

- Instância nova conectada hoje → entra como `AGUARDANDO_MATURACAO`, não conversa.
- A cada ciclo (a cada 30 min), checa se completou 5 dias e promove para `EM_AQUECIMENTO`.
- Dashboard mostra claramente quantos dias faltam para entrar em aquecimento.
- Sem impacto em instâncias já existentes (todas têm mais de 5 dias).

## Custo Lovable Cloud

Sem aumento. A regra apenas atrasa o início, sem adicionar consultas significativas (1 query extra por ciclo de promoção).
