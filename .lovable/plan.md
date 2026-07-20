# Auto-etiqueta de atendente no Inbox Meta

## Objetivo
Quando um cliente enviar ou responder mensagem no Inbox Meta, o sistema identifica se existe acordo cadastrado com esse telefone e aplica automaticamente uma etiqueta com o nome do atendente que lançou o acordo. A etiqueta fica travada — só admin remove. Se nenhum acordo for encontrado, a conversa segue para a fila normal de atendentes (sem etiqueta automática).

## Matching de telefone (tolerante ao "9" móvel)

Regra global do projeto já é "sufixo de 8 dígitos". Aplicando aqui:

- Normalizar ambos os lados removendo tudo que não é dígito.
- Comparar pelos **últimos 8 dígitos**. Isso resolve o caso (63) 98114-0477 (acordo) vs (63) 8114-0477 (WhatsApp): ambos terminam em `81140477`.
- Filtro SQL:
  ```sql
  right(regexp_replace(cliente_telefone,'\D','','g'), 8)
    = right(regexp_replace($telefone_da_mensagem,'\D','','g'), 8)
  ```
- Se houver mais de um acordo com esse sufixo, escolher o mais recente por `criado_em`.

## Fluxo

1. **Detecção no webhook Meta** (`supabase/functions/meta-whatsapp-webhook/index.ts`)
   - Após persistir uma mensagem inbound (cliente enviou/respondeu), disparar `aplicarEtiquetaAtendente(contato_id, telefone)`.
   - Idempotente: se o contato já tem etiqueta automática, sai.
   - Busca `acordos` pelo sufixo de 8 dígitos → pega `user_id` do atendente → lê `profiles.nome`.
   - Se nada encontrado: não faz nada (fila padrão).

2. **Aplicar etiqueta**
   - Escopo (`user_id` da etiqueta): dono do contato (`meta_whatsapp_contatos.user_id`), mesmo padrão do sistema.
   - `upsert` em `meta_whatsapp_etiquetas` com `nome = 'Atendente: <profile.nome>'`, cor fixa `#25D366`.
   - `insert` em `meta_whatsapp_contato_etiquetas` com nova coluna `origem = 'auto_atendente'`.

3. **Trava da etiqueta automática**
   - Migração:
     - `ALTER TABLE meta_whatsapp_contato_etiquetas ADD COLUMN origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','auto_atendente'))`.
     - Ajustar policy de `DELETE` para bloquear remoção quando `origem = 'auto_atendente'`, exceto se `has_role(auth.uid(),'admin')`.
     - Policy de `DELETE` em `meta_whatsapp_etiquetas`: bloquear (não-admin) quando existir vínculo `auto_atendente` na etiqueta.

4. **UI**
   - `src/components/inbox/meta/MetaConversaContextMenu.tsx`: ícone de cadeado ao lado do nome da etiqueta automática; toggle no submenu mostra toast "Etiqueta do atendente — apenas admin pode remover" para não-admin. Admin remove normalmente.
   - `src/components/inbox/meta/MetaEtiquetasDialog.tsx`: idem — botão excluir desabilitado para não-admin quando etiqueta tem vínculo automático.
   - Detectar `isAdmin` via `useUserRole`.
   - Carregar `origem` no fetch de `meta_whatsapp_contato_etiquetas` na página do Inbox Meta para passar aos componentes.

5. **Backfill (uma execução)**
   - SQL na migração: para cada `meta_whatsapp_contatos` sem etiqueta automática, cruzar por sufixo de 8 dígitos com o acordo mais recente daquele telefone, criar/reaproveitar `meta_whatsapp_etiquetas` do dono do contato com `nome = 'Atendente: <profile.nome>'` e inserir vínculo com `origem = 'auto_atendente'`.

## Detalhes técnicos

- Nenhum cron novo — a lógica roda dentro do webhook já existente (custo desprezível).
- Reaproveita `MetaAtendenteNotifier` (já busca etiquetas `Atendente: <nome>`), então o beep do atendente logado continua funcionando sem alteração.
- Arquivos afetados:
  - Migração SQL (coluna `origem`, policies, backfill).
  - `supabase/functions/meta-whatsapp-webhook/index.ts`.
  - `src/components/inbox/meta/MetaConversaContextMenu.tsx`.
  - `src/components/inbox/meta/MetaEtiquetasDialog.tsx`.
  - `src/pages/InboxMeta.tsx` (carregar `origem` no join de etiquetas).
