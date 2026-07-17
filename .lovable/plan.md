## Problema 1 — Falha "template não aprovado" na MEMU 25

**Causa raiz confirmada** (via query no banco + leitura da edge function):
- No banco, a instância `MEMU 25` **tem** o template `lembrete_envio_boleto` com `status='approved'` (idioma `pt_BR`).
- A edge function `send-whatsapp-meta` (linha 267) só aceita `template_id` no body — ela ignora o objeto `template` e refaz a busca no banco.
- Tanto `meta-lembrete-teste-instancias` quanto `meta-lembrete-tick` chamam `send-whatsapp-meta` passando `{ instancia_id, cliente, template }` (objeto), **sem** `template_id`. Isso faz o `send-whatsapp-meta` cair no erro de parâmetros / template não encontrado, cuja mensagem chega no frontend como falha do template.

**Correção:** passar `template_id: template.id` nas duas invocações (`meta-lembrete-teste-instancias/index.ts` e `meta-lembrete-tick/index.ts`), mantendo o restante do payload igual.

## Problema 2 — Diálogo de teste com preview e variáveis editáveis

Hoje o botão "Testar instâncias" abre um diálogo com apenas o campo telefone e usa `{{1}}='Teste'` e `{{2}}=data de hoje` fixos.

**Novo diálogo em `src/pages/LembreteMeta.tsx`:**
1. Campo **Telefone de teste** (mantém, com `localStorage`).
2. **Preview do template** `lembrete_envio_boleto`: mostra o `body_text` com as variáveis substituídas em tempo real (usa o `templatePreview` já carregado).
3. **Campos dinâmicos de variáveis** — detecta placeholders `{{n}}` no `body_text` via regex e renderiza um `<Input>` por variável, com defaults:
   - `{{1}}` → "Teste"
   - `{{2}}` → data de hoje (BR)
   - demais → vazio (o usuário preenche)
4. Botão **"Testar agora"** envia `{ instancia_ids, telefone, variaveis: { '1': ..., '2': ... } }` para a edge function.

**Backend `meta-lembrete-teste-instancias`:**
- Aceita `variaveis` opcional no body; se ausente, mantém defaults `{ '1': 'Teste', '2': hoje }`.
- Passa `template_id: template.id` na invocação de `send-whatsapp-meta` (corrigindo o Problema 1).

## Arquivos alterados

- `supabase/functions/meta-lembrete-teste-instancias/index.ts` — aceitar `variaveis`, passar `template_id`.
- `supabase/functions/meta-lembrete-tick/index.ts` — passar `template_id` em `invokeSendMeta`.
- `src/pages/LembreteMeta.tsx` — novo diálogo com preview e inputs por variável.

Sem mudanças de schema, tabelas ou cron.
