

## Reconectar WhatsApp via QR Code no botão Editar

### O que será feito
Adicionar um botão "Reconectar" dentro do formulário de edição de instância, visível apenas quando a instância está desconectada. Ao clicar, o sistema reutiliza a instância existente (sem criar uma nova) e exibe o QR Code para reconexão.

### Alterações em `src/pages/Acionamento.tsx`

1. **Novo handler `handleReconnectQr`**: Similar ao `handleRefreshQr`, mas recebe o `instanceId` da instância sendo editada. Chama a action `qr` da edge function `whatsapp-qr` com o ID da instância existente, exibe o QR code inline no formulário de edição, e inicia o polling de status.

2. **Botão "Reconectar via QR" no formulário de edição**: Quando `editingInstance.id` existe e o `connectionStatus[editingInstance.id]` é `'disconnected'`, mostrar um botão com ícone `QrCode` dentro do formulário de edição (entre os campos e o botão Salvar). Ao clicar, chama `handleReconnectQr`.

3. **QR Code inline no formulário de edição**: Quando o QR é obtido para reconexão, exibir a imagem do QR e o pairing code diretamente dentro do formulário de edição (mesma UI do fluxo de conexão existente — imagem, countdown, polling).

4. **Estado auxiliar**: Adicionar um state `reconnectingInstanceId` para diferenciar o fluxo de reconexão do fluxo de nova conexão. O polling de status reutiliza `startQrPolling` existente, e ao conectar com sucesso fecha o formulário de edição automaticamente.

