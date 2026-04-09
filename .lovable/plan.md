

## Aquecimento Manual — Teste de IA Conversacional

### O que será feito

Adicionar um botão "🧪 Teste IA Manual" no header da página de Aquecimento que abre um dialog onde o usuário pode:

1. Selecionar 2 ou mais instâncias da lista de números em aquecimento (com checkboxes)
2. Clicar em "Iniciar Teste" para disparar mensagens entre os pares selecionados
3. Ver o resultado em tempo real (toast de sucesso/erro)

### Como funciona

Ao clicar "Iniciar Teste":
- O frontend chama a Edge Function `whatsapp-aquecimento` com um novo action `manual-test` passando os IDs das instâncias selecionadas
- A function envia uma mensagem aleatória de cada instância para outra do grupo selecionado (round-robin)
- Registra na tabela `whatsapp_aquecimento_interacoes` normalmente
- O webhook `whatsapp-chatbot` detectará as respostas e acionará a IA automaticamente

### Arquivos alterados

**`src/pages/Aquecimento.tsx`**
- Novo botão "🧪 Teste IA Manual" no header
- Dialog com lista de instâncias em aquecimento (checkboxes para seleção múltipla)
- Botão "Iniciar Teste" que chama a edge function
- Feedback via toast

**`supabase/functions/whatsapp-aquecimento/index.ts`**
- Novo handler para `action: "manual-test"` que recebe `instance_ids: string[]`
- Envia uma mensagem de texto simples entre cada par de instâncias selecionadas
- Reutiliza o pool de frases de diálogo existente
- Retorna quantas mensagens foram enviadas

### Fluxo de teste

1. Abra a aba Aquecimento → clique em "🧪 Teste IA Manual"
2. Selecione 2+ instâncias → clique "Iniciar Teste"
3. Instância A envia mensagem para B (e vice-versa)
4. O webhook detecta a mensagem e aciona a IA (Gemma 4)
5. A IA responde automaticamente após 15-90s
6. Verifique no Log de Interações e no Inbox

