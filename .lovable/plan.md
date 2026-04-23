

## Plano: Diagnóstico e Reparo de Webhooks das Instâncias WhatsApp

Você relatou que enviou muitas mensagens hoje mas não recebeu NENHUMA resposta no Inbox. Isso é sintoma clássico de webhook desconfigurado — provavelmente colateral da operação anti-grupos de ontem (que reconfigurou todos os webhooks via `uazapi-disable-group-webhooks`).

### Hipótese principal

Quando rodamos a função de pânico ontem para parar o sangramento de $8,28, a chamada para a UAZAPI pode ter:
1. Sobrescrito o webhook com uma URL errada/vazia, OU
2. Configurado os filtros tão restritivos que mensagens recebidas (DMs reais) também foram bloqueadas, OU
3. Removido o evento `messages` por completo deixando só exclusões

Resultado: respostas dos clientes chegam no celular mas nunca disparam o webhook → nunca aparecem no Inbox.

### O que será feito

**1. Diagnóstico (nova edge function `diagnose-webhooks`)**
Para cada instância ativa, consultar a UAZAPI (`GET /webhook` ou `GET /instance/status`) e retornar:
- URL configurada atualmente
- Eventos ativos
- Filtros de exclusão aplicados
- Status da conexão WhatsApp

Resultado mostrado em uma tabela no Monitor de Envios.

**2. Reparo automático (ajuste em `whatsapp-qr` action `setup-webhook-all`)**
Reconfigurar TODAS as instâncias com a config correta:
```
url: <projeto>/functions/v1/whatsapp-chatbot
events: ["messages"]                    ← ESSENCIAL para receber respostas
excludeGroupMessages: true              ← bloqueia grupos (mantém economia)
excludeBroadcast: true                  ← bloqueia status
excludeMessages: ["wasSentByApi"]       ← bloqueia eco de envios próprios
```

Isso garante que **DMs de clientes voltem a chegar** mas grupos continuem bloqueados (memória `never-load-group-messages` preservada).

**3. Botão "Diagnosticar e Reparar Webhooks" no Monitor de Envios**
Substitui/complementa o botão de pânico. Fluxo:
- Click → roda diagnóstico → mostra estado atual de cada instância
- Mostra botão "Reparar Todas" → reconfigura com a config correta
- Toast confirma sucesso por instância

**4. Validação pós-reparo**
Após o reparo, verificar se a próxima mensagem recebida em qualquer instância chega na tabela `whatsapp_mensagens_inbox` nos próximos 5 minutos (instrução visual ao usuário).

### Arquivos afetados

- `supabase/functions/diagnose-webhooks/index.ts` (novo)
- `supabase/functions/whatsapp-qr/index.ts` (revisar `setup-webhook-all` para garantir `events: ["messages"]`)
- `src/pages/MonitorEnvios.tsx` (botão diagnóstico + modal de resultado)

### Custo Lovable Cloud

Zero adicional. Pelo contrário: **restaurar o webhook é o que destrava o valor real do sistema** (respostas de clientes = acordos fechados). Sem novas tabelas, sem IA, sem cron novo.

### Memórias respeitadas

- ✅ `never-load-group-messages`: filtros `excludeGroupMessages` e `excludeBroadcast` mantidos
- ✅ `cloud-cost-awareness`: nenhum aumento de invocações esperado
- ✅ `phone-suffix-matching-standard`: não toca em lógica de matching

### Fora de escopo

- Não mexer no fluxo de envio (que está OK, já enviou 17 mensagens hoje)
- Não recriar instâncias (só reconfigurar webhooks)
- Não tocar no autosave/aquecimento

