

# Histórico de Conversa WhatsApp na aba ENVIADOS

## Resumo
Quando um cliente responder a mensagem enviada, o status na aba ENVIADOS mudará de "Enviado" para "Em negociação". Ao clicar nesse badge, abrirá um dialog com o histórico completo da conversa WhatsApp em formato de chat.

## Como funciona tecnicamente

A tabela `chatbot_conversas` já armazena o histórico de mensagens no campo `dados.mensagens_historico` (array de `{role, content, ts}`). Quando a mensagem é enviada, o `useAutoSend` já cria um registro nessa tabela com o telefone do cliente. O chatbot adiciona mensagens do cliente e do assistente conforme a conversa avança.

## Mudanças

### 1. Buscar estado da conversa para cada telefone enviado (`Acionamento.tsx`)
- Após carregar a lista de enviados, fazer um query em `chatbot_conversas` para os telefones dos clientes enviados
- Verificar se `dados.mensagens_historico` contém mensagens do cliente (role = 'cliente') — isso indica que o cliente respondeu
- Armazenar o resultado em um state `conversasMap: Record<string, {etapa, historico}>`
- Usar polling (30s) ou realtime para atualizar o status automaticamente

### 2. Mudar o badge de Status dinamicamente
- Se o cliente respondeu (tem mensagem com role 'cliente' no histórico): badge **"Em negociação"** (azul, clicável)
- Se a etapa for `aguardando_humano`: badge **"Aguardando"** (amarelo, clicável)
- Se a etapa for `acordo_finalizado`: badge **"Acordo"** (verde, clicável)
- Caso contrário: manter o badge atual "Enviado"

### 3. Dialog de histórico de conversa
- Ao clicar no badge, abrir um `Dialog` com o histórico formatado como chat
- Mensagens do assistente (role 'assistente') à direita com fundo verde (estilo WhatsApp)
- Mensagens do cliente (role 'cliente') à esquerda com fundo branco/cinza
- Cada mensagem mostra horário formatado
- Exibir etapa atual da conversa no header do dialog

### 4. Normalização de telefone
- O telefone na tabela de enviados pode estar em formato diferente (ex: `62982184132`) do que está na `chatbot_conversas` (ex: `5562982184132` sem o 9)
- Criar função de normalização para fazer o match corretamente (mesma lógica do `useAutoSend`: prefixar 55 e remover 9° dígito)

## Arquivos alterados
- `src/pages/Acionamento.tsx` — query de conversas, badges dinâmicos, dialog de histórico

