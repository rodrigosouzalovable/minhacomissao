# CPF do cliente na conversa (Envio Meta → Inbox Meta Oficial)

Levar o CPF da planilha importada até o topo da conversa e usá-lo para o IAGO não precisar pedir o documento.

## O que será feito

1. **Guardar o CPF na conversa**
   - A conversa (contato) passa a ter um campo de CPF.
   - No disparo em massa, o CPF que veio da coluna mapeada como "CPF / CNPJ" da planilha é gravado na conversa criada/atualizada, junto com nome e telefone. Vale tanto no modo serial quanto no Modo Rajada.
   - Se a conversa já existir sem CPF, o novo envio preenche o CPF; um CPF já existente não é sobrescrito por valor vazio.

2. **Mostrar no topo da conversa**
   - Na linha onde já aparecem o telefone do cliente e "via {nosso número}", passa a aparecer o CPF formatado como `000.000.000-00` (CNPJ formatado como `00.000.000/0000-00`).
   - Ao lado dele, um botão de copiar (mesmo padrão do botão do telefone), que copia apenas os dígitos.
   - Quando a conversa não tem CPF vinculado, nada é exibido — o layout continua igual ao de hoje.
   - Fallback: se a conversa não tiver CPF gravado, o sistema ainda tenta identificar pelo telefone (últimos 8 dígitos) na base de telefones vinculados, como já acontece hoje no IAGO.

3. **IAGO deixa de pedir o CPF quando já existe**
   - Antes de responder, o IAGO passa a usar primeiro o CPF gravado na conversa (prioridade máxima), depois a identificação por telefone, e só pede o CPF ao cliente quando nenhuma das duas fontes encontra nada.
   - Com o CPF conhecido, ele já entra com nome e proposta calculada; se o CPF da planilha não tiver débitos em aberto, ele informa isso e escala para humano em vez de ficar pedindo documento.
   - O mesmo CPF é usado no follow-up, evitando repetir pedido de documento.

## Detalhes técnicos

- Migração: adicionar coluna `cpf text` em `meta_whatsapp_contatos` (nullable, sem alterar RLS/grants existentes).
- `supabase/functions/send-whatsapp-meta/index.ts`: gravar `cpf: cliente.cpf` no insert do contato e no update (`coalesce` — só preenche se vier valor).
- `supabase/functions/envio-meta-massa-tick/index.ts` e `envio-meta-massa-burst/index.ts`: já enviam `cpf` do `envio_meta_job_item`; nenhuma mudança de payload necessária.
- `src/pages/InboxMeta.tsx`: incluir `cpf` no select de contatos, helper `formatarDoc(digits)` (11 → CPF, 14 → CNPJ) e render do CPF + `CopyButton` no cabeçalho.
- `supabase/functions/_shared/iago.ts` / `iago-atendimento` / `iago-followup-tick`: usar `contato.cpf` como primeira fonte em `resolverTelefone`/estado da conversa e ajustar o prompt (proibido pedir CPF quando já identificado).
- Sem novos cron, polling ou índices pesados — nenhum impacto de custo no Cloud.
