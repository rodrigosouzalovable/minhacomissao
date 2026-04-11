

## Diagnóstico e Correção do Aquecimento de WhatsApp

### Problemas Identificados

1. **Nenhuma mensagem está sendo trocada**: Os logs de hoje mostram que TODAS as instâncias estão sendo puladas por "dia silencioso" (20% chance), "dia somente-leitura" (15% chance), "em carência" ou "fora do horário". Combinado com o fato de que apenas 1 instância é selecionada por ciclo e ainda tem 30% de chance de ser pulada, o resultado é 0 mensagens trocadas.

2. **Mensagens de aquecimento NÃO aparecem no Inbox**: A função `whatsapp-aquecimento` salva as interações apenas na tabela `whatsapp_aquecimento_interacoes`, mas **não registra na tabela `whatsapp_mensagens`** (que alimenta o Inbox). Então mesmo quando mensagens são enviadas, elas não aparecem no Inbox.

3. **IA responder não está sendo chamada**: Como nenhuma mensagem é enviada, a função `whatsapp-ia-responder` (que gera respostas com IA) nunca é invocada. Ela tem zero logs recentes.

### Correções Planejadas

#### 1. Reduzir percentuais anti-ban (mais mensagens por dia)
- **Silent day**: de 20% → **10%** (menos dias completamente silenciosos)
- **Read-only day**: de 15% → **8%** (menos dias sem mensagens)
- **Skip cycle**: de 30% → **15%** (menos ciclos pulados)
- Processar **até 2 instâncias por ciclo** ao invés de apenas 1

#### 2. Registrar mensagens de aquecimento no Inbox
Na função `whatsapp-aquecimento`, após enviar uma mensagem com sucesso (linha ~766), inserir também na tabela `whatsapp_mensagens`:
- Mensagem de saída (da instância que enviou)
- Isso permite ver no Inbox quem enviou o quê

#### 3. Garantir que a IA responder logue ambos os lados no Inbox
A função `whatsapp-ia-responder` já tem `logToInbox` — verificar que está sendo chamada corretamente e que loga tanto a resposta enviada quanto a mensagem recebida.

### Arquivos Modificados
- `supabase/functions/whatsapp-aquecimento/index.ts` — reduzir percentuais, adicionar log ao Inbox, processar mais instâncias por ciclo
- `supabase/functions/whatsapp-ia-responder/index.ts` — verificar e garantir log completo no Inbox

### Resultado Esperado
- Mais mensagens trocadas por dia entre os números
- Todas as conversas de aquecimento visíveis no WhatsApp Inbox
- IA respondendo e respostas também visíveis no Inbox

