

## Mensagens Rápidas (Atalhos) no WhatsApp Inbox

### O que será feito
1. **Criar tabela `whatsapp_mensagens_rapidas`** para armazenar os atalhos configurados pelo usuário, com campos: `id`, `user_id`, `titulo`, `tipo` (texto/audio/botoes), `conteudo` (texto da mensagem), `audio_url`, `botoes_texto`, `botoes_choices`, `ordem`, `criado_em`

2. **Ícone de engrenagem** ao lado do ícone de etiqueta no header do Inbox, abrindo um Dialog de configuração

3. **Dialog de configuração** com:
   - Lista das mensagens rápidas já cadastradas (com opção de editar/excluir)
   - Botão "Adicionar" com seleção de tipo: Texto, Áudio, Botões
   - Campo "Título" (obrigatório) — será o nome exibido no botão
   - Campo de conteúdo conforme o tipo:
     - **Texto**: textarea para a mensagem
     - **Áudio**: upload de arquivo de áudio (salvo no bucket `inbox-media`)
     - **Botões**: texto da mensagem + até 3 botões (choices)

4. **Botões de atalho acima do campo de digitação** (`ChatInputBar`):
   - Barra horizontal com scroll com os botões nomeados pelo título
   - Ao clicar, envia automaticamente a mensagem na conversa ativa usando as funções existentes (`send-whatsapp`, `send-whatsapp-audio`, `send-whatsapp-buttons`)

### Arquivos modificados
- **Migration SQL**: criar tabela `whatsapp_mensagens_rapidas` com RLS (user_id = auth.uid())
- **`src/pages/WhatsAppInbox.tsx`**: adicionar ícone engrenagem, estado do dialog, fetch dos atalhos, passar atalhos para ChatInputBar
- **`src/components/inbox/ChatInputBar.tsx`**: receber lista de atalhos, renderizar botões acima do input, executar envio ao clicar
- **Novo: `src/components/inbox/MensagensRapidasDialog.tsx`**: Dialog completo de CRUD dos atalhos

### Fluxo de envio ao clicar no atalho
- **Texto**: chama `onTextSent(conteudo)` diretamente
- **Áudio**: invoca `send-whatsapp-audio` com a `audio_url` salva
- **Botões**: invoca `send-whatsapp-buttons` com texto e choices salvos

