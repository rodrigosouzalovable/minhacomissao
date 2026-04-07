

## Análise de Viabilidade e Plano

### Funcionalidade 1: Reset Automático — JÁ IMPLEMENTADO

O sistema atual **já usa a Opção B** (query dinâmica). O hook `useMonitorEnvios.ts` calcula os contadores em tempo real filtrando `whatsapp_mensagens` por `direcao = 'saida'` e `timestamp_msg >= hoje`. Não existe contador armazenado — ao virar a meia-noite, a query naturalmente retorna 0 para o novo dia. **Nenhuma alteração necessária.**

### Funcionalidade 2: Assistente IA — Mentora de Aquecimento

Criar um chatbot especializado integrado ao Monitor de Envios, usando Lovable AI (sem API key extra).

#### Arquitetura

- **Edge Function `whatsapp-mentor`**: Recebe a pergunta + dados de contexto, chama a IA com system prompt especializado em aquecimento de WhatsApp
- **Dados de contexto**: Enviados pelo frontend junto com a pergunta (total enviadas, instâncias ativas, limites, etc.) — evita function calling complexo e mantém tudo dentro do RLS
- **Persistência**: Tabela `mentor_conversas` para histórico do chat
- **UI**: Botão flutuante + Sheet/Drawer lateral com chat

#### Etapas

**1. Criar tabela `mentor_conversas`**
```sql
CREATE TABLE public.mentor_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role TEXT NOT NULL, -- 'user' ou 'assistant'
  content TEXT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT now()
);
-- RLS: usuários veem apenas suas próprias mensagens
```

**2. Criar Edge Function `whatsapp-mentor`**
- Recebe: `{ pergunta, contexto: { totalEnviadas, totalAtivas, instances[], limiteDiario, delaySegundos }, historico[] }`
- System prompt detalhado sobre estratégias de aquecimento, limites seguros, detecção de risco
- Usa Lovable AI (modelo `google/gemini-2.5-flash`)
- Retorna resposta especializada

**3. Criar componente `MentorChat.tsx`**
- Sheet lateral com histórico de mensagens
- Chips de sugestões rápidas ("Posso aumentar o limite?", "Meu padrão parece robótico?", etc.)
- Renderização markdown das respostas
- Botão de limpar histórico

**4. Alterar `MonitorEnvios.tsx`**
- Adicionar botão flutuante "💬 Consultar Especialista" no canto inferior direito
- Passar dados do monitor como contexto para o chat

#### Arquivos a criar/alterar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/whatsapp-mentor/index.ts` | Criar |
| `src/components/monitor/MentorChat.tsx` | Criar |
| `src/pages/MonitorEnvios.tsx` | Adicionar botão flutuante |
| Migração SQL | Criar tabela `mentor_conversas` |

#### Dados que a IA receberá como contexto

O frontend enviará um snapshot dos dados do monitor junto com cada pergunta, sem necessidade de function calling:
- Total enviadas hoje, instâncias ativas, limite e delay configurados
- Lista de instâncias com: nome, enviadas hoje, último envio, status, tipo
- Isso permite respostas personalizadas sem queries adicionais na Edge Function

