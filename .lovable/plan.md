

## Liberar Aquecimento para Todos os Usuarios

### Problema atual
- A aba Aquecimento so aparece para admins (`adminOnly: true`)
- As tabelas de aquecimento (`whatsapp_aquecimento_instancias`, `whatsapp_aquecimento_interacoes`, etc.) so permitem acesso admin via RLS
- A Edge Function usa `admin_user_id` da config para buscar instancias — precisa buscar de todos os usuarios

### Seguranca
A tabela `user_whatsapp_instances` ja tem RLS que filtra por `user_id = auth.uid()`. As politicas das tabelas de aquecimento vao referenciar essa tabela, garantindo que cada usuario so veja dados das **suas proprias instancias**.

### Alteracoes

#### 1. Migration — RLS para tabelas de aquecimento
Adicionar politicas SELECT/UPDATE para usuarios autenticados nas tabelas:
- `whatsapp_aquecimento_instancias` — SELECT/UPDATE onde `instancia_id` pertence ao usuario
- `whatsapp_aquecimento_interacoes` — SELECT onde origem ou destino pertence ao usuario
- `whatsapp_conversas_ia` — SELECT onde origem ou destino pertence ao usuario
- `whatsapp_aquecimento_agendamentos` — SELECT
- `whatsapp_aquecimento_status_log` — SELECT
- `aquecimento_notificacoes` — SELECT/UPDATE onde `instancia_id` pertence ao usuario

Criar funcao helper `owns_whatsapp_instance(instance_id uuid)` SECURITY DEFINER para evitar recursao.

#### 2. `src/components/layout/AppLayout.tsx`
- Remover `adminOnly: true` da rota `/aquecimento`

#### 3. `src/pages/Aquecimento.tsx`
- Nenhuma mudanca necessaria nos queries — a RLS ja vai filtrar automaticamente via `user_whatsapp_instances.user_id`
- Esconder botoes de config global (dias ativos, hora inicio/fim) para nao-admins
- Esconder botao "Teste Manual IA" para nao-admins (pois envolve instancias de outros usuarios)

#### 4. Edge Function `whatsapp-aquecimento/index.ts`
- Remover dependencia de `admin_user_id` — buscar TODAS as instancias ativas de TODOS os usuarios
- O pareamento so acontece entre instancias do MESMO usuario (nunca cruzar instancias de usuarios diferentes)

### O que NAO muda
- Admins continuam vendo tudo (politicas existentes)
- A logica de fases e warming permanece igual
- Sem aumento de custo

