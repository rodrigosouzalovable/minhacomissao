## Objetivo
Registrar os 7 grupos novos ("Família Souza e Ribeiro 1" a "7") no sistema de aquecimento, importando os membros reais de cada grupo (lidos direto do WhatsApp via UAZAPI), para que todos conversem entre si todo dia — usando o motor já existente.

## Bom saber: o motor já existe
A função `aquecimento-grupo-conversa` (cron a cada 15min, 07h–21h BRT, exceto domingo) **já itera todos os grupos ativos** em `whatsapp_aquecimento_grupos`. Não precisa duplicar lógica de envio. O que falta é apenas:
1. Cadastrar os 7 grupos no banco com o `group_jid` correto.
2. Popular os membros (`whatsapp_aquecimento_grupo_membros`) com as instâncias que estão em cada grupo.
3. Criar a `whatsapp_aquecimento_grupo_config` para cada grupo (com defaults atuais).

## Plano

### 1. Nova edge function `aquecimento-grupos-descobrir-e-registrar`
Acionável por um botão na UI. Para cada instância ativa:
- Chama `/group/list` (endpoint UAZAPI já usado em `get-group-jid`).
- Filtra grupos cujo nome contenha "Família Souza e Ribeiro" (case-insensitive).
- Deduplica por `group_jid`.

Para cada JID encontrado (esperado: 7):
- `upsert` em `whatsapp_aquecimento_grupos` (nome do WhatsApp, `group_jid`, `instancia_admin_id` = a primeira instância que retornou o grupo, `ativo=true`).
- `upsert` em `whatsapp_aquecimento_grupo_config` com defaults (15–25 msgs/dia, 70/20/10, carência 24h).
- Para cada participante do grupo (campo `participants` da resposta UAZAPI), faz match do número (sufixo 8 dígitos, conforme regra do projeto) com `user_whatsapp_instances.numero` e cria/atualiza `whatsapp_aquecimento_grupo_membros` com `status='ok'` e `adicionado_em=now()-25h` (pula carência inicial para começar imediatamente).

Retorna um resumo: `{ grupos_registrados: 7, membros_inseridos: N, membros_por_grupo: {...} }`.

### 2. UI: botão na aba "Conversa em Grupo"
Em `src/components/aquecimento/ConversaGrupoPanel.tsx` (ou `GrupoAquecimentoCard.tsx`), adicionar:
- Botão **"Descobrir grupos Família Souza e Ribeiro"** que invoca a função acima e mostra toast com o resumo.
- Lista os 7 grupos descobertos com contagem de membros e toggle ativo/inativo (já existe).

### 3. Sem mudanças no motor de envio
O cron em `aquecimento-grupo-conversa` já trata múltiplos grupos em paralelo no loop. Cada grupo terá sua própria meta diária independente (15–25 msgs/dia) e seu próprio sorteio de cena.

## Detalhes técnicos

- **Match de número**: usa sufixo de 8 dígitos (regra do projeto) entre `participant.id` (formato `5562xxxxxxxx@s.whatsapp.net`) e `user_whatsapp_instances.numero`.
- **Instância admin do grupo**: a primeira instância (entre as conectadas) que listou o grupo via `/group/list` — geralmente é membro/admin nativo.
- **Carência**: setamos `adicionado_em` para 25h atrás para o grupo começar a conversar já no próximo ciclo de cron, sem esperar 24h.
- **Grupo antigo "Família Souza e Ribeiro"**: deixamos como está; se quiser desativar depois é só toggle.
- **Custo**: zero adicional. O motor já roda, só multiplica por 7 a quantidade de mensagens/dia (~105–175 msgs/dia distribuídas entre ~70 instâncias).

## Arquivos a criar/editar
- **Criar**: `supabase/functions/aquecimento-grupos-descobrir-e-registrar/index.ts`
- **Editar**: `src/components/aquecimento/ConversaGrupoPanel.tsx` (adicionar botão de descoberta)

Sem migração de banco — o schema atual já suporta múltiplos grupos.