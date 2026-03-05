

## Plan: Chatbot WhatsApp Automático para Negociação de Dívidas

### Como funciona

Sim, é possível. A UAZAPI suporta **webhooks** (como mostra seu print) que notificam sua aplicação quando uma mensagem é recebida. O fluxo será:

```text
Cliente envia msg → UAZAPI Webhook → Edge Function (chatbot) → Consulta banco → Responde via UAZAPI
```

### O que precisa ser feito

**1. Configurar o Webhook na UAZAPI (manual, no painel UAZAPI)**
- Em cada instância, configurar o webhook apontando para sua Edge Function
- URL: `https://cymdrkeukockakfzjeen.supabase.co/functions/v1/whatsapp-chatbot`
- Habilitar o webhook, ativar `addUrlEvents` e `addUrlTypesMessages`
- Em "Escutar eventos", colocar `messages`
- Em "Excluir dos eventos escutados", colocar `wasSentByApi` e `isGroupYes`

**2. Criar tabela `chatbot_conversas` para gerenciar estado da conversa**
- Armazena o telefone do cliente, o passo atual (aguardando_cpf, cpf_recebido, etc.) e dados temporários
- Permite que o bot saiba em qual etapa está cada conversa

**3. Criar Edge Function `whatsapp-chatbot`**
- Recebe o webhook da UAZAPI com a mensagem do cliente
- Consulta o estado da conversa pelo número de telefone
- Fluxo do bot:
  1. **Mensagem inicial recebida** → Responde com saudação e pede o CPF
  2. **CPF recebido** → Consulta a tabela `devedores` usando a função `consultar_debitos_por_cpf`
  3. **Débitos encontrados** → Calcula desconto 50% (à vista) e 30% (parcelado com opções de 2x a 24x, mínimo R$90/parcela) e envia a proposta formatada
  4. **Débitos não encontrados** → Informa que não há pendências para o CPF
- Envia respostas usando o endpoint UAZAPI `/message/sendText`

**4. Adicionar página de configuração no admin (opcional, fase 2)**
- Toggle para ativar/desativar chatbot por instância
- Personalizar mensagens do bot

### Fluxo da conversa do bot

```text
Bot: "Olá! Sou o assistente virtual da Souza e Ribeiro. 
      Para consultar sua situação, por favor informe seu CPF."

Cliente: "123.456.789-00"

Bot: "Encontrei 3 contratos em seu nome, totalizando R$ 5.000,00.

      💰 QUITAÇÃO À VISTA (50% OFF):
      R$ 2.500,00 em parcela única

      📋 PARCELADO (30% OFF):
      R$ 3.500,00 em até 24x de R$ 145,83

      Para negociar, entre em contato: (62) 98218-3144"
```

### Arquivos a criar/modificar
- **Migração SQL**: Criar tabela `chatbot_conversas` (telefone, etapa, dados, timestamps)
- **`supabase/functions/whatsapp-chatbot/index.ts`**: Edge Function principal do chatbot
- **`supabase/config.toml`**: Registrar a função com `verify_jwt = false` (webhook externo)

### Pré-requisito do seu lado
Você precisará configurar o webhook manualmente no painel da UAZAPI para cada instância que deseja ativar o chatbot, conforme a tela que você mostrou no print.

