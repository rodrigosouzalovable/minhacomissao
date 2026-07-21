## Problema confirmado

Anna Flávia abriu a conversa com Célio Raio Solidade, mas a etiqueta "Atendente: Anna Flavia Leite de Morais" não foi aplicada.

Causa raiz (verificada via banco + código):
- A etiqueta cadastrada é `Atendente: Anna Flavia Leite de Morais` (nome completo do perfil).
- Em `src/pages/InboxMeta.tsx` linhas 144-151, o front resolve `atendenteNome` como apelido curto (`"Anna Flavia"`) via tabela `APELIDOS`, e envia esse curto no campo `atendente_nome` do `send-whatsapp-meta`.
- Em `supabase/functions/send-whatsapp-meta/index.ts` linha 515-521, a busca da etiqueta usa `ilike` com o valor exato `Atendente: Anna Flavia`, sem curinga → não encontra a etiqueta completa e cai no ramo "etiqueta não existe, ignorando".

O mesmo padrão afeta Wallace, Yasmim, Fernanda: o apelido curto nunca casa com a etiqueta canônica (nome completo).

Como o webhook (respostas do cliente) usa outra função e busca por prefixo `Atendente:%`, aquele fluxo já grava com cadeado; só o fluxo de **iniciar conversa** (nova conversa e reabrir com template) está falhando.

## Correção

1. `supabase/functions/send-whatsapp-meta/index.ts` (bloco linhas 511-536):
   - Trocar a busca pontual por match por prefixo, priorizando o nome mais longo:
     - `select id, nome from meta_whatsapp_etiquetas where user_id = inst.user_id and nome ilike 'Atendente: <primeiro-nome>%' order by length(nome) desc limit 1`.
   - Mantém `origem: 'auto_atendente'` no vínculo → cadeado já funciona via RLS/UI existentes.
   - Não cria etiqueta nova (regra: só usuário cria).

2. Aplicar a mesma correção nas funções que também iniciam/mandam mensagens do atendente e recebem `atendente_nome`:
   - `supabase/functions/send-whatsapp-meta-text/index.ts` — adicionar bloco equivalente após persistir contato (hoje não etiqueta).
   - `supabase/functions/send-whatsapp-meta-media/index.ts` — idem, se aceitar `atendente_nome` (verificar; se não aceitar, só atender ao request quando enviado via reabrir/nova conversa por template — que já cai no `send-whatsapp-meta`).

3. Sem alterações de UI necessárias: o cadeado é renderizado a partir de `origem='auto_atendente'` e da política de RLS existente em `meta_whatsapp_contato_etiquetas` (admin remove; demais usuários não).

## Verificação

- Rodar novo envio de template pela aba "Nova conversa" com login da Anna Flávia → conferir que o contato criado recebe vínculo com a etiqueta `Atendente: Anna Flavia Leite de Morais` e origem `auto_atendente`.
- Testar também com Wallace (etiqueta `Atendente: Wallace Maciel`) para garantir o match por prefixo.
- Confirmar visualmente cadeado na UI e que usuário comum não consegue remover.
- Não retroagir para conversas antigas — apenas novas conversas iniciadas passam a vir etiquetadas.
