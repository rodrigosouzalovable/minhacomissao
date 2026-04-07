

## Plano: Filtrar Aquecimento por Usuário (owner)

### Problema

O sistema atual inscreve **todas** as 47 instâncias ativas no aquecimento, incluindo as de outros usuários (Anna Flavia: 2, Daniel: 1). Apenas as suas 44 instâncias devem participar.

### O que será feito

| # | Ação |
|---|------|
| 1 | Filtrar a Edge Function `whatsapp-aquecimento` para inscrever e processar apenas instâncias do admin (seu `user_id`) |
| 2 | Remover da tabela `whatsapp_aquecimento_instancias` as instâncias que não são suas (3 registros de outros usuários) |
| 3 | Inserir as instâncias suas que ainda não foram cadastradas no aquecimento |

### Detalhes técnicos

**Edge Function** (`supabase/functions/whatsapp-aquecimento/index.ts`):
- Na query de auto-enrollment (linha 66-69), adicionar filtro `.eq("user_id", ADMIN_USER_ID)` para buscar apenas instâncias do admin
- Isso garante que instâncias de funcionários nunca entrem no aquecimento automaticamente
- O `user_id` do admin será obtido via config (`whatsapp_aquecimento_config`) com uma nova chave `admin_user_id`, ou hardcoded como constante

**Dados**:
- DELETE das 3 instâncias de outros usuários na tabela de aquecimento
- INSERT das instâncias suas que faltam (das 44 ativas, as que não estão cadastradas)

### Alternativa futura

Quando o sistema virar multi-tenant, cada usuário poderá ter seu próprio aquecimento — mas por agora, filtramos pelo admin.

