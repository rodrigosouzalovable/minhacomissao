## Objetivo

No Inbox Meta Oficial, sempre que um cliente enviar mensagem (direção `entrada`) e a conversa **ainda não tiver** nenhuma etiqueta do tipo `Atendente: X`, atribuir automaticamente uma etiqueta de atendente via rodízio, para garantir que toda conversa respondida por cliente tenha um responsável.

## Onde entra a lógica

Único ponto: `supabase/functions/meta-whatsapp-webhook/index.ts`, logo após o `upsert` do contato (linhas 378–415), e **somente quando `!isEcho`** (mensagem recebida). Nada muda no frontend nem no schema.

## Regras

1. Só age quando `isEcho === false` (mensagem do cliente).
2. Resolve o `contato_id` (do `existenteFinal` ou do insert recém-criado).
3. Verifica se já existe qualquer vínculo em `meta_whatsapp_contato_etiquetas` cuja etiqueta case `nome ILIKE 'Atendente:%'` para aquele `user_id` (dono da instância). Se já houver → não faz nada.
4. Se não houver → seleciona todas as etiquetas `Atendente: %` do `user_id = inst.user_id` e escolhe a **menos carregada** (menor número de contatos atualmente vinculados a ela), com desempate alfabético pelo `nome`. Isso é rodízio estável e não depende de estado adicional.
5. Insere `meta_whatsapp_contato_etiquetas { contato_id, etiqueta_id }`. Usa `on conflict do nothing` para evitar corrida entre webhooks concorrentes.
6. Se não existir nenhuma etiqueta `Atendente: %` cadastrada, apenas loga e sai — comportamento antigo preservado.

## Detalhes técnicos

- Consulta de carga por atendente:
  ```sql
  select e.id, e.nome, count(ce.contato_id) as carga
    from meta_whatsapp_etiquetas e
    left join meta_whatsapp_contato_etiquetas ce on ce.etiqueta_id = e.id
   where e.user_id = :userId and e.nome ilike 'Atendente:%'
   group by e.id, e.nome
   order by carga asc, e.nome asc
   limit 1;
  ```
  Implementado no edge com duas queries simples (etiquetas + contagens) porque o cliente supabase-js do Deno não suporta agregação direta; ou via `rpc` inline. Vou fazer com duas queries + agregação em memória (poucas etiquetas, custo desprezível).
- Envolvido em `try/catch` isolado — falha na atribuição **não** interrompe o processamento do webhook.
- Log estruturado `[MetaWebhook] atendente atribuido { contato_id, etiqueta_id, atendente }`.

## Fora de escopo

- Não altera contatos antigos que já estão sem atendente (só reage a novas mensagens recebidas). Se quiser um backfill único para os já existentes, é uma segunda tarefa — posso fazer depois se pedir.
- Não muda regras do notificador de som (`MetaAtendenteNotifier`).
- Nenhuma mudança visual.

## Arquivos alterados

- `supabase/functions/meta-whatsapp-webhook/index.ts` — novo bloco de auto-atribuição após o upsert de contato no laço de mensagens.
