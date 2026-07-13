## Diagnóstico

Confirmei no banco:
- O template `agende_a_videoconferncia` tem `variaveis = {"1":"", "2":"", "_components":[...]}` — ambas as chaves numéricas estão **vazias**.
- Todos os 393 registros do job em execução foram gravados com `vars = {}` (não vieram do mapeamento).
- `nome` e `cpf` foram gravados corretamente por linha (via `parseRecipients` do CSV).

Com `rowVars` vazio e `variaveis["1"]/["2"]` vazios, o `send-whatsapp-meta` cai no fallback `inferFieldForPlaceholder`, que hoje olha **40 caracteres para trás E 40 para frente** de cada `{{n}}`. No corpo:

```
Olá {{1}}! O CNPJ {{2}} foi validado...
```

- Contexto de `{{1}}`: `Olá ` (antes) + `! O CNPJ {{2}} foi validado com sucesso` (depois) → casa `/cnpj/` → retorna `{cpf}`.
- Contexto de `{{2}}`: casa `/cnpj/` também → retorna `{cpf}`.

Resultado: as duas variáveis recebem `cliente.cpf`, gerando *"Olá 67870421000144! O CNPJ 67870421000144…"*.

## Correção

### 1. `supabase/functions/send-whatsapp-meta/index.ts` — corrigir `inferFieldForPlaceholder`

A heurística deve olhar principalmente para o **rótulo que precede** o placeholder (convenção natural em pt-BR: "Olá {{1}}", "O CNPJ {{2}}", "Saldo: {{3}}"). Passa a considerar:

- ~30 caracteres **antes** do placeholder como contexto primário.
- Só ~3 caracteres depois (para pegar pontuação, não outras palavras).
- Ordem de match reordenada: `nome/cliente/olá/prezado/sr` antes de `cnpj/cpf/documento`, pois "Olá" costuma vir antes de "CNPJ" no mesmo trecho.
- Fallback por posição quando o contexto é vazio: `{{1}}` → `{nome}`, `{{2}}` → `{cpf}`, `{{3}}` → `{saldo}`.

Isso corrige o job já em execução sem precisar re-importar — os próximos itens usam a nova heurística e `cliente.nome`/`cliente.cpf` (que estão preenchidos corretamente no `envio_meta_job_item`).

### 2. Bonus — garantir que o mapeamento também persista o campo padrão

No `MapearColunasImportDialog.tsx`, quando o usuário marca uma coluna como `tplvar:1`/`tplvar:2` mas o template descreve claramente que aquela variável é `{cpf}` ou `{nome}`, já temos `nome`/`cpf` no CSV via `parseRecipients`. Sem alteração adicional necessária — o fix #1 já cobre.

## Escopo

- Arquivo alterado: `supabase/functions/send-whatsapp-meta/index.ts` (apenas função `inferFieldForPlaceholder`, ~15 linhas).
- Sem migração, sem mudança de UI, sem mudança em outros edge functions.
- Job atual (`198efe01…`) passa a mandar as próximas mensagens já corrigidas.

## Verificação após deploy

1. Rodar `test-meta-connection` ou aguardar próximo tick do job rodando.
2. Conferir uma mensagem entregue pela conversa do Inbox — deve aparecer `Olá <Nome Fantasia>! O CNPJ <14 dígitos> foi validado...`.
3. Se necessário, pausar/retomar o job para acelerar a validação.