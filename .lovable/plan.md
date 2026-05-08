## Objetivo

Substituir a lógica atual (1 admin único adicionando vários números) por um **round-robin entre todas as instâncias que já são admin do grupo "Família Souza e Ribeiro"**, com limites baixos por admin e delays grandes, para evitar o `blocked-integrity-enforcement` que baniu a `62981810202 IPHONE B1 08/05`.

## Mudanças

### 1. `supabase/functions/add-to-warming-group/index.ts` — refatorar

**Descobrir admins em tempo real (a cada execução):**
- Para cada grupo ativo, chamar `POST {server_url}/group/info` (com `groupjid`) usando o token da `instancia_admin_id` registrada. Isso retorna a lista de participantes com flag `IsAdmin`/`isAdmin`.
- Cruzar os JIDs de admin com `user_whatsapp_instances` (match pelo telefone extraído do `nome` da instância, padrão atual `^\d+`, com prefixo `55` se faltar) e considerar apenas as `ativo=true`.
- Resultado: **pool dinâmico de admins-adders** para aquele ciclo. Se o admin oficial do grupo não estiver mais como admin no WhatsApp, escolher outro admin do pool como `adder` daquele ciclo (sem alterar `instancia_admin_id` automaticamente — só logar).

**Round-robin e limites:**
- Cap por admin: **2 adds/dia** (consulta `whatsapp_aquecimento_grupo_membros` filtrando por `adicionado_por_instancia_id` + `status='ok'` + `adicionado_em >= hoje 00:00 BRT`). Requer nova coluna (ver item 2).
- Cap global do grupo: **5 adds/dia** (subir de 3 → 5, distribuídos).
- A cada ciclo (cron a cada 30 min), no máximo **1 add por execução** (mantém o atual).
- Escolher o adder do ciclo: o admin do pool com **menos adds hoje** e com **maior tempo desde o último add** (anti-padrão).
- Escolher a `instancia_alvo` (quem vai ser adicionado): primeira `user_whatsapp_instances` ativa, com ≥5 dias de idade, que ainda não esteja `ok`/`removido_manualmente` no grupo e tenha `tentativas < 5`.
- Janela: 07h–21h BRT, sem domingo (já existe).
- Delay: como roda 1 por ciclo, o próprio cron de 30 min serve. Remover o `setTimeout 30–120s` interno (não é mais necessário).

**Tratamento de erros:**
- Se a chamada de adição retornar `blocked-integrity-enforcement` ou `not allowed` para a inst admin, **desativar essa admin do pool por 24h** (gravar `bloqueado_ate` em uma nova coluna do membro do grupo) e tentar com o próximo admin no próximo ciclo. Não banir o registro inteiro.
- Manter resiliência UAZAPI: HTTP 200 com `fallback:true` em `disconnected`.

### 2. Migration: novas colunas em `whatsapp_aquecimento_grupo_membros`

- `adicionado_por_instancia_id uuid null` — qual admin executou o add (para contagem por adder).
- `bloqueado_ate timestamptz null` — quando aquele membro/admin volta a poder adicionar (cooldown anti-ban).

Index: `(grupo_id, adicionado_por_instancia_id, adicionado_em)` para a query de cap diário.

### 3. Data ops (insert tool)

- `UPDATE user_whatsapp_instances SET ativo=false WHERE nome ILIKE '62981810202 IPHONE B1 08/05'` — desativar a banida.
- `UPDATE whatsapp_aquecimento_grupos SET instancia_admin_id = '<uuid de outro admin do grupo>'` — escolher uma das instâncias que você promoveu a admin como nova "admin oficial" do registro (será usada só para chamadas de leitura/`group/info`; os adds são distribuídos no pool).
- Para descobrir o melhor candidato, vou rodar `POST /group/info` antes (via curl edge function) para listar quem está como admin hoje, e te apresentar a lista; você escolhe ou eu pego a primeira ativa com mais idade.

### 4. Não mexer

- Cron `add-to-warming-group-30min` permanece como está (a função interna passa a respeitar todos os novos limites).
- Estrutura da tabela `whatsapp_aquecimento_grupos` permanece (nenhuma coluna nova lá).
- Webhook do grupo, conversas automáticas dentro do grupo: **fora do escopo** desta tarefa.

## Resultado esperado

- Máximo de 5 adds por dia no grupo, divididos entre os admins (cada um faz ≤2/dia).
- Nenhum admin é exposto a "rajada"; cada cycle usa 1 admin diferente.
- Se um admin tomar `blocked-integrity-enforcement`, ele entra em cooldown automático e os outros continuam.
- A inst banida (`62981810202`) sai do sistema (ativo=false) e deixa de ser usada.

## Confirmações

1. Posso rodar `get-group-jid`/`group/info` agora para listar quem está como admin no grupo e te mostrar antes de trocar `instancia_admin_id`? Ou prefere que eu já escolha automaticamente a inst ativa mais antiga?
2. Aprova as duas colunas novas em `whatsapp_aquecimento_grupo_membros`?
