

# Plano: Selecionar instância principal de lembretes no Configurações WhatsApp

## O que muda
Cada funcionário poderá escolher, dentro do dialog "Configurações WhatsApp", qual das suas instâncias UAZAPI cadastradas será a **principal para envio de lembretes**. Hoje isso é configurado manualmente pelo admin via campos de texto. A ideia é substituir por um **select/dropdown** das instâncias já cadastradas.

## Alterações

### 1. UI no dialog "Configurações WhatsApp" (`src/pages/Acionamento.tsx`)
- Adicionar uma nova seção **"WhatsApp Principal para Lembretes"** logo após a lista de instâncias
- Um `Select` dropdown listando as instâncias do usuário + opção "Nenhuma (usar global)"
- Ao selecionar, salvar `server_url` e `instance_token` da instância escolhida nos campos `whatsapp_lembrete_server_url` e `whatsapp_lembrete_instance_token` da tabela `profiles`
- Remover a necessidade do `WhatsAppLembreteConfigDialog` separado (que era usado pelo admin para configurar por funcionário)

### 2. Lógica de salvamento
- Quando o usuário seleciona uma instância no dropdown, faz `update` no `profiles` com o `server_url` e `instance_token` daquela instância
- Quando seleciona "Nenhuma", limpa ambos campos (seta `null`)
- Carregar a seleção atual comparando os campos do `profiles` com as instâncias cadastradas

### 3. Sem alterações no backend
- As edge functions `check-payment-reminders` e `process-whatsapp-queue` já leem de `profiles.whatsapp_lembrete_server_url/instance_token` - continuam funcionando normalmente
- Não precisa de nova tabela nem migração

