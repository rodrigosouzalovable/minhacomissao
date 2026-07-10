## Objetivo
Ao enviar um template pela "Nova conversa Meta", o contato deve aparecer na lista com a etiqueta identificando o atendente que enviou — **para qualquer usuário logado**, não só os que já tinham a etiqueta criada.

## Diagnóstico
A lógica já existe em `supabase/functions/send-whatsapp-meta/index.ts` (linhas ~428-450): procura uma etiqueta chamada `Atendente: {nome}` do `user_id` dono da instância e vincula ao contato. Mas se essa etiqueta **não existe**, ela é apenas ignorada (log). Por isso funciona só para alguns usuários que já criaram a etiqueta manualmente.

Além disso, o `atendente_nome` enviado é do **usuário logado no frontend**, enquanto a etiqueta é buscada no `user_id` da **instância Meta** (dono). Em times compartilhados, são pessoas diferentes — a etiqueta precisa ser do atendente que enviou, no escopo do dono da instância (que é onde as etiquetas aparecem na inbox).

## Mudança

**Arquivo:** `supabase/functions/send-whatsapp-meta/index.ts` (bloco de auto-etiqueta, ~linha 428-450)

Substituir a busca simples por um "get-or-create":
1. `SELECT` etiqueta `Atendente: {nome}` em `meta_whatsapp_etiquetas` para `user_id = inst.user_id`.
2. Se não existir, `INSERT` com nome `Atendente: {atendenteNome}`, `user_id = inst.user_id` e uma cor derivada do nome (hash simples → paleta fixa de 8 cores) para diferenciar visualmente cada atendente.
3. Vincular em `meta_whatsapp_contato_etiquetas` (como já faz).
4. Tratar corrida (23505 já é ignorado no insert de vínculo; para o insert da etiqueta em si, em caso de conflito re-selecionar).

## Fora de escopo
- Nenhuma mudança de UI, RLS, schema, permissões ou rotas.
- Não altera o formato `*Atendente Nome:*` do preview.
- Não mexe em Inbox UAZAPI (essa tela é só Meta).

## Detalhes técnicos
- Paleta: `['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316']`, índice por soma de char codes do nome.
- Insert de etiqueta usa `service role` (a função já usa client de service), então RLS não bloqueia.
- Se `atendenteNome` vier vazio (usuário sem `profiles.nome`), continua sem etiquetar (comportamento atual).

## Validação
Após o deploy da função: com um usuário sem etiqueta prévia, enviar template pela "Nova conversa Meta" e confirmar que o card do contato exibe a nova etiqueta `Atendente: {nome}` na lista.
