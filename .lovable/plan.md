

## Lembretes WhatsApp por Funcionário

### Situação Atual
- Os lembretes de pagamento usam credenciais UAZAPI **globais** (do admin) para enviar todas as mensagens
- Cada funcionário já tem um toggle "WhatsApp habilitado" no perfil, mas todos os envios saem pela mesma instância
- A tabela `whatsapp_fila` não armazena qual instância UAZAPI usar

### O que será feito

#### 1. Migração: Adicionar campos de instância na fila e no perfil
- Adicionar `server_url` e `instance_token` à tabela `whatsapp_fila` para que cada mensagem saiba por qual instância enviar
- Adicionar `whatsapp_lembrete_server_url` e `whatsapp_lembrete_instance_token` à tabela `profiles` para armazenar a instância principal de lembretes de cada usuário

#### 2. Componente: Dialog de configuração WhatsApp do usuário
- Criar `WhatsAppConfigDialog` com campos Server URL e Instance Token
- O admin poderá configurar a instância principal de cada funcionário diretamente na página de Usuários
- Botão com ícone WhatsApp ao lado dos botões de ação existentes

#### 3. Atualizar Edge Function `check-payment-reminders`
- Ao buscar parcelas pendentes, também buscar as credenciais UAZAPI do perfil do usuário dono do acordo
- Inserir `server_url` e `instance_token` do usuário na fila junto com a mensagem
- Se o usuário não tiver instância configurada, usar fallback das credenciais globais

#### 4. Atualizar Edge Function `process-whatsapp-queue`
- Ao processar uma mensagem da fila, usar `server_url` e `instance_token` da própria mensagem
- Fallback para credenciais globais se os campos estiverem vazios (compatibilidade com mensagens antigas)

#### 5. UI na página AdminUsuarios
- Adicionar botão "WhatsApp" na coluna de ações de cada usuário
- Ao clicar, abre o dialog com os campos de configuração da instância UAZAPI
- Mostrar badge indicando se o usuário tem instância configurada

### Arquivos a modificar
- **Migração SQL**: adicionar colunas em `whatsapp_fila` e `profiles`
- **`src/components/WhatsAppLembreteConfigDialog.tsx`**: novo componente
- **`src/pages/AdminUsuarios.tsx`**: adicionar botão e dialog
- **`supabase/functions/check-payment-reminders/index.ts`**: buscar credenciais do usuário
- **`supabase/functions/process-whatsapp-queue/index.ts`**: usar credenciais por mensagem

