## Diagnóstico

Na tabela `envio_meta_job_item`, o campo `vars` chegou **vazio** (`{}`) mesmo o usuário tendo mapeado as colunas na planilha. Com `rowVars={}`, o `send-whatsapp-meta` cai no fallback `inferFieldForPlaceholder` para descobrir o campo de cada `{{n}}`.

Corpo do template: `Olá *{{1}}*! O CNPJ {{2}} foi validado com sucesso...`

Para `{{2}}`, a janela de 30 caracteres ANTES vira `*{{1}}*! O CNPJ ` — que contém tanto "Olá" quanto "CNPJ". Como o `inferFieldForPlaceholder` testa `{nome}` (olá/prezado/…) **antes** de `{cpf}`, `{{2}}` é resolvido incorretamente como `{nome}` → puxa `cliente.nome` (razão social) no lugar do CNPJ.

Bug secundário: precisamos entender por que `vars` está `{}` nos itens (o mapeamento na tela está correto, mas não chegou ao worker). Isso é o que faria a substituição direta funcionar sem depender do inferência.

## Correções

### 1. `supabase/functions/send-whatsapp-meta/index.ts` — `inferFieldForPlaceholder`

- Trocar a janela "30 chars antes" pelo **rótulo imediato**: pegar apenas o texto entre o `}}` anterior (ou início do body) e o `{{n}}` atual. Assim `{{2}}` vê só `*! O CNPJ ` — sem contaminação com "Olá" do `{{1}}`.
- Inverter a ordem dos testes: checar `cnpj|cpf|documento` **antes** de `olá|prezado|…`, para casos em que ambos aparecem no mesmo rótulo.
- Manter os fallbacks posicionais atuais (`1→nome`, `2→cpf`, `3→saldo`).

### 2. `supabase/functions/envio-meta-massa-iniciar/index.ts` — investigar vars

Rodar consulta para confirmar se o payload que chega no `iniciar` já traz `vars` vazio, ou se o insert perde os dados. Se o payload já vem vazio, o bug está no cliente (`EnvioMeta.tsx` → `varsByTel` chave por telefone). Ajuste no chaveamento se necessário — não vou tocar nisso antes de confirmar via `code--exec`.

*Prioridade:* aplicar a correção do `inferFieldForPlaceholder` primeiro, que já resolve o caso concreto reportado. Depois investigar o motivo do `vars` estar vazio na tabela para restabelecer a substituição direta.

## Verificação

Após o patch, testar mentalmente com o body real:
- `{{1}}` → contexto imediato `Olá *` → matches `olá` → `{nome}` ✓
- `{{2}}` → contexto imediato `*! O CNPJ ` → matches `cnpj` → `{cpf}` ✓

Não é preciso migração/DB nem alteração de UI.
