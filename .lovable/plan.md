## Objetivo
Enviar o nome **completo** do cliente (como digitado na aba Destinatários) quando o template usar a variável de nome, em vez de só o primeiro nome.

## Diagnóstico
Em `supabase/functions/send-whatsapp-meta/index.ts`, a função `resolveNamedVar` força primeiro nome:

```ts
if (n === 'name' || n === 'nome' || n === 'primeiro_nome')
  return formatPrimeiroNome(c.nome || '') || 'cliente';
```

E `resolveVar` trata `{nome}` e `{primeiro_nome}` igualmente (ambos retornam só o primeiro nome em alguns caminhos). Por isso, mesmo enviando "João Silva Souza", chega só "João".

## Mudança
Em `supabase/functions/send-whatsapp-meta/index.ts`:

1. `resolveNamedVar`: tratar `name` / `nome` / `nome_completo` / `full_name` como **nome completo** (`c.nome`). Manter `primeiro_nome` como primeiro nome.
2. `resolveVar`: `{nome}` → nome completo; `{primeiro_nome}` continua primeiro nome.
3. Fallback "cliente" só quando `c.nome` estiver vazio.

Sem mudanças no frontend, no banco, ou em outros templates/fluxos. Sem custo adicional.

## Fora de escopo
- Adicionar nova variável separada (`{nome_completo}`) — não é necessário, basta corrigir o comportamento atual.
- Mudanças no painel de detalhes ou no health check.
