## Problema
No webhook `meta-whatsapp-webhook`, toda mensagem de entrada dispara a lógica de "Etiqueta do atendente" (match por acordo + rodízio) — independente da caixa em que o contato está. Assim, mesmo contatos na caixa `AQUECIMENTO` recebem etiqueta `Atendente: ...`.

## Solução
Pular toda a atribuição automática de atendente quando o contato pertence a uma caixa customizada (`folder_id IS NOT NULL`). A caixa "Padrão" tem `folder_id = null` e continua com rodízio + match por acordo normalmente.

## Alteração
- `supabase/functions/meta-whatsapp-webhook/index.ts`, bloco "Etiqueta do atendente" (~linhas 484–610):
  - Após obter `contatoIdFinal`, ler `folder_id` do contato (ou aproveitar o já carregado no upsert).
  - Se `folder_id != null`, `continue`/pular todo o bloco de atribuição de atendente (match por acordo e rodízio).
  - Caixa padrão (`folder_id = null`) mantém comportamento atual.

Sem mudanças no frontend nem em outras funções.