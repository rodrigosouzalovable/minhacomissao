# Admin por caixa de mensagens + rodízio real na caixa AMARAL

## 1. Admin da caixa (novo checkbox no diálogo de atendentes)

No diálogo "Atendentes da caixa X", cada linha passa a ter **duas caixinhas**:

- a atual (participa da caixa);
- uma nova, à direita, **"Admin"** — marca aquele usuário como administrador daquela caixa.

O admin da caixa (ex.: Thiago Nogueira na AMARAL) passa a poder abrir esse mesmo diálogo e **marcar/desmarcar outros usuários** naquela caixa, além de definir outros admins da mesma caixa. Ele continua sem poder mexer em outras caixas. Administradores gerais e o dono da caixa seguem com acesso total.

Regras:
- Só é possível marcar "Admin" para quem já é atendente da caixa (marcar Admin marca também como atendente).
- Desmarcar o usuário da caixa remove também o status de admin dela.
- Vale para caixas criadas e para a caixa "Padrão".

## 2. Rodízio da caixa AMARAL

O que foi verificado no banco (caixa AMARAL, 5 responsáveis):

| Atendente | Ordem na fila | Etiqueta | Fila ativa | Permissão |
|---|---|---|---|---|
| Gabriel | 5 | ok | sim | sim |
| Lais | 6 | ok | sim | sim |
| Poliana | 7 | ok | sim | sim |
| Thiago Nogueira | 8 | ok | sim | sim |
| Rebeca Amaral | 24 | ok | sim | sim |

A fila e as etiquetas estão corretas — o rodízio circular por caixa já é o mesmo motor da caixa Padrão. O desequilíbrio vem de um passo **anterior** ao rodízio: a regra "quem enviou a última mensagem para o contato fica com a etiqueta". Nos últimos 2 dias, dos 202 envios da AMARAL, **186 foram feitos pelo login do Thiago** (Poliana 11, Gabriel 5, Lais 1). Resultado das atribuições de hoje: Thiago 21, Poliana 1, Lais 1, Gabriel 0, Rebeca 0. Na caixa Padrão isso não aparece porque os envios saem de vários logins diferentes.

O que será feito:
- Quando a mensagem de saída foi um **disparo em massa/campanha** (ou template de abertura), ela deixa de valer como "iniciou a conversa" — a conversa cai no rodízio da caixa.
- Só continua valendo o vínculo com o remetente quando a mensagem foi digitada manualmente na conversa pelo atendente.
- Mantidas as prioridades anteriores: acordo com o mesmo telefone → consulta de CPF no portal (7 dias) → atendente que respondeu manualmente → rodízio circular.
- Continua uma única etiqueta de atendente por conversa e nada muda no plantão do IAGO.
- Após o ajuste, uma consulta de acompanhamento das atribuições do dia por atendente na AMARAL para confirmar a distribuição 1-2-3-4-5.

## Detalhes técnicos

- Migração: coluna `admin boolean not null default false` em `meta_inbox_folder_members` e `meta_inbox_default_members`; `meta_inbox_folder_can_manage(_uid, _folder)` passa a aceitar também `EXISTS (... members where user_id=_uid and admin)`; nova função equivalente para a caixa Padrão (`_folder is null` → `meta_inbox_default_members.admin`); policies de INSERT/UPDATE/DELETE de `meta_inbox_folder_members` e `meta_inbox_default_members` passam a usar essas funções. Backfill: `admin = true` para o `owner_id` de cada caixa.
- `src/components/inbox/meta/MetaFolderAcessoDialog.tsx`: carregar `admin` junto com os membros, segundo checkbox "Admin" por linha, `toggleAdmin` gravando na tabela correspondente, e habilitar o diálogo para admins de caixa (hoje aberto pelo menu de contexto do Inbox e por `MetaFoldersDialog`).
- Onde o menu de contexto/`MetaFoldersDialog` decide exibir "Atendentes da caixa", incluir a condição de admin da caixa além de admin global/owner.
- `supabase/functions/meta-whatsapp-webhook/index.ts` (bloco "Match por quem realmente iniciou/atendeu a conversa", ~linhas 775-825): ao ler a última mensagem `direcao='saida'`, ignorar registros de campanha/disparo em massa (mensagens com `template_nome`/origem de campanha) e só considerar envio manual; sem essa condição, seguir direto para `atribuir_atendente_rodizio`.
