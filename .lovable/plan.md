# Aba Blacklist (contatos que pediram bloqueio)

## Situação atual (verificada)
- O bloqueio automático já funciona: quando o cliente clica/responde "Bloquear contato", o webhook grava o número na tabela de supressão com motivo iniciado por `blacklist:` (respeitando a chave "Bloquear Blacklist" da aba Envio Meta), e o disparo em massa já ignora esses números.
- Hoje só existe registro do telefone, do motivo e das datas — não é guardado de qual instância/campanha veio, então ainda não é possível dizer a um Parceiro Meta "estes são os seus".
- A tabela só tem regra de acesso para administradores; nenhum parceiro consegue ler nada dela hoje.
- Ainda não há nenhuma linha com motivo de blacklist (as 21 linhas existentes são supressões por falha de entrega).

## O que vai ser feito

### 1. Registrar a origem do bloqueio
Ao entrar na blacklist, passa a ser guardado também:
- a instância (número) que enviou a mensagem que originou o clique;
- o dono/parceiro responsável por aquela instância;
- o nome do contato (quando já conhecido no Inbox) e o credor da campanha, quando disponível.

Assim cada bloqueio fica atribuído a quem disparou.

### 2. Nova aba "Blacklist" no menu lateral
Página nova com:
- Lista dos números bloqueados: telefone formatado, nome do contato (se houver), número/instância de origem, credor, motivo e data/hora do bloqueio.
- Busca por telefone ou nome, filtro por período e filtro por instância.
- Contador total no topo e botão "Exportar Excel".
- Ação "Remover da blacklist" (somente administradores) para reabilitar um número que pediu bloqueio por engano.
- Link direto para abrir a conversa desse número no Inbox Meta Oficial.

### 3. Visibilidade
- Administradores: veem todos os bloqueios.
- Parceiros Meta: veem apenas os bloqueios originados nas instâncias vinculadas a eles (mesma regra de visibilidade já usada nas outras telas Meta). A aba aparece no menu lateral para eles.
- Demais usuários: aba visível apenas se liberada nas permissões, e nunca com dados de parceiros.

## Detalhes técnicos

Banco (migração):
- `meta_destinatario_supressao`: novas colunas `instancia_id uuid` (FK `meta_whatsapp_instances`), `origem_user_id uuid`, `contato_nome text`, `credor text`; índices em `instancia_id` e `criado_em`.
- Novas policies de leitura: `select` para `authenticated` quando `has_role(auth.uid(),'admin')` OU `pode_ver_instancia_meta(auth.uid(), instancia_id)`; `delete` restrito a admin. Mantém a policy admin-all existente.
- Grants já existentes preservados; se necessário, `GRANT SELECT` a `authenticated`.

Backend:
- `_shared/iago.ts`: `suprimirDestinatario` recebe parâmetros opcionais de origem (`instancia_id`, `origem_user_id`, `contato_nome`, `credor`) e os grava no upsert (sem sobrescrever com nulo).
- `meta-whatsapp-webhook/index.ts`: no bloco de blacklist já existente, passa a instância da mensagem, o `user_id`/parceiro dessa instância e o nome/credor do contato.
- Sem novo cron, polling ou realtime — nenhum impacto de custo no Cloud.

Frontend:
- `src/pages/Blacklist.tsx` (nova página) com consulta paginada, `staleTime` alto e sem refetch automático.
- Rota `/admin/blacklist` em `src/App.tsx` sob `PermissionRoute`.
- Item `{ href: '/admin/blacklist', label: 'Blacklist', icon: Ban }` em `navItems` de `AppLayout.tsx`, exibido para admin e para usuários com `parceiro_meta`.
