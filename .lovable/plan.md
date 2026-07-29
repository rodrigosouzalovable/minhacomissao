# Correção: templates não aparecem em Nova Conversa Meta

## Diagnóstico (confirmado)

A instância **IPHONE B2** (`40d6e63a-...`) possui 3 templates UTILITY aprovados no banco, mas o diálogo mostra "Nenhum template para esta instância".

A causa está na política RLS da tabela `meta_whatsapp_templates`:

```
Users manage templates of own instances:
  EXISTS(instance WHERE i.user_id = auth.uid() OR has_role('admin'))
```

Só o **dono técnico** da instância (ou admin) consegue ler os templates. Já a tabela `meta_whatsapp_instances` tem uma política extra (`meta_instances_shared_select` via `has_inbox_compartilhado`) que permite atendentes com acesso compartilhado enxergarem a instância — mas essa mesma permissão **não existe para os templates**. Resultado: o atendente enxerga a instância no Select e tenta abrir conversa, mas o `SELECT` dos templates volta vazio.

O padrão do Inbox Meta (mesmo problema resolvido antes para `inbox-media`) é: qualquer usuário autenticado com acesso ao Inbox pode operar as instâncias e portanto precisa ler os templates aprovados delas.

## Correção

Migration SQL adicionando policy de leitura nos templates para usuários com acesso compartilhado ao Inbox, espelhando a lógica já usada em `meta_whatsapp_instances`:

```sql
CREATE POLICY meta_templates_shared_select
ON public.meta_whatsapp_templates
FOR SELECT
TO authenticated
USING (has_inbox_compartilhado(auth.uid()));
```

Isso mantém as políticas existentes (dono + admin + tenant) intactas e apenas adiciona SELECT para quem tem acesso compartilhado ao Inbox. Nada de escrita é afetado — INSERT/UPDATE/DELETE continuam restritos ao dono/admin. Nenhuma finding de segurança anterior (`meta_whatsapp_templates_utility_broad_select`) é reaberta porque não damos acesso a `anon` nem a `authenticated` amplo — só a atendentes com `has_inbox_compartilhado`.

## Validação

Após aplicar:
1. Rodar `SELECT count(*) FROM meta_whatsapp_templates WHERE instancia_id='40d6e63a-...' AND status='approved' AND categoria='UTILITY'` como um atendente compartilhado (via app) — deve retornar 3.
2. Reabrir "Nova conversa Meta" com IPHONE B2 selecionado → templates aprovados devem listar.

Nenhuma mudança em frontend é necessária — `MetaNovaConversaDialog.tsx` já faz o filtro correto (`status=approved`, `categoria=UTILITY`, `instancia_id`).
