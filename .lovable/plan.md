

# Ensinar a IA: Regras personalizadas de resposta

## Objetivo
Adicionar na aba IA um botão "Ensinar IA" que abre um formulário para criar regras do tipo: **"Quando o cliente disser X, responda Y"**. Essas regras serão consultadas pelo chatbot antes de gerar qualquer resposta via IA.

## Nova tabela: `chatbot_regras`

```sql
CREATE TABLE public.chatbot_regras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gatilho TEXT NOT NULL,        -- "quando o cliente disser..."
  resposta TEXT NOT NULL,       -- "responda isso..."
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);
```

RLS: admins gerenciam, edge function lê via service role.

## UI no `ChatbotTemplatesTab.tsx`

- Botão "Ensinar IA" no topo da página, abre um Dialog
- Dialog com dois campos:
  - **"Quando o cliente disser:"** (Input) — ex: "quero boleto", "como pago"
  - **"Responda com:"** (Textarea) — ex: "Vou gerar o boleto para você agora!"
- Lista de regras já criadas abaixo, com opção de editar/excluir/ativar-desativar
- Card separado na aba mostrando todas as regras ativas

## Edge Function `whatsapp-chatbot/index.ts`

- Ao processar uma mensagem, antes de chamar `gerarRespostaHumana`, buscar todas as regras ativas de `chatbot_regras`
- Verificar se o texto do cliente contém algum dos gatilhos (busca case-insensitive, substring match)
- Se encontrar match, usar a resposta da regra diretamente (sem IA)
- Se não encontrar, seguir o fluxo normal
- As regras também serão injetadas no system prompt da IA como contexto adicional

