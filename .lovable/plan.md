## Objetivo

No **modo rajada**, quando uma instância receber o erro Meta `#132015` ("template pausado por baixa qualidade"), o worker daquela instância deve:

1. Parar imediatamente de tentar enviar por aquele número.
2. **Redistribuir os contatos pendentes** dela para as outras instâncias que ainda estão ativas no job.
3. Deixar o restante do envio seguir normalmente pelos números ativos.
4. Só encerrar o job com erro se **todas** as instâncias caírem no mesmo problema.

## Mudanças

### 1. `supabase/functions/send-whatsapp-meta/index.ts`
- Ao receber resposta da Meta, detectar `error.code === 132015` (ou mensagem `template ... is paused`).
- Retornar novo flag na resposta: `template_paused: true, instance_disable: true, error: "Template pausado pela Meta"`.
- Não alterar `estado_pool` da instância (o problema é do template, não do número).

### 2. `supabase/functions/envio-meta-massa-burst/index.ts`
- No `enviarUm`, tratar `resp?.template_paused` como novo `SendResult.kind = 'template_paused'`.
- Ao receber `template_paused` no loop:
  - Devolver o item atual para `pendente`.
  - Buscar `job.instancia_ids` menos as instâncias já marcadas como bloqueadas neste job.
  - Se sobrar pelo menos uma instância ativa: fazer `UPDATE envio_meta_job_item SET instancia_id = <round-robin entre ativas> WHERE job_id=? AND instancia_id=<atual> AND status='pendente'`, e disparar `selfInvoke` para as ativas processarem.
  - Se **não sobrar** instância ativa: marcar itens restantes desta instância como `erro` com motivo "Todas as instâncias com template pausado" e chamar `tentarEncerrarJob`.
  - Encerrar este worker (não reagendar).
- Persistir a lista de instâncias bloqueadas em uma coluna nova `envio_meta_job.instancias_bloqueadas jsonb DEFAULT '[]'` (via migração).

### 3. Migração
- `ALTER TABLE public.envio_meta_job ADD COLUMN IF NOT EXISTS instancias_bloqueadas jsonb NOT NULL DEFAULT '[]'::jsonb;`

### 4. UI — `src/components/meta/CampanhaDetalheDialog.tsx`
- Ler `job.instancias_bloqueadas` e mostrar um badge "Template pausado — instância desativada neste envio" ao lado do nome da instância no bloco de estatísticas.

## Fora do escopo
- Não alterar o modo tick (não-rajada) nem os workers de lembrete.
- Não mexer em qualidade de instância (RED/YELLOW) — o comportamento atual permanece.
