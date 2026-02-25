

# Transformar engrenagem em Dialog com teste de envio

## O que muda

Atualmente, o ícone de engrenagem alterna para uma aba "config" inline. A mudança é: ao clicar na engrenagem, abrir um **Dialog** contendo toda a configuração UAZAPI existente + um novo campo de telefone com botão "Testar envio" que envia a mensagem "mensagem teste" via a edge function `send-whatsapp`.

## Alteração em `src/pages/Acionamento.tsx`

1. **Importar** `Dialog, DialogContent, DialogHeader, DialogTitle` de `@/components/ui/dialog`
2. **Adicionar estados**:
   - `configDialogOpen` (boolean) para controlar o dialog
   - `testPhone` (string) para o campo de telefone
   - `sendingTest` (boolean) para loading do botão
3. **Alterar o botão da engrenagem** (linha 637-644): em vez de alternar `activeTab`, abrir o dialog via `setConfigDialogOpen(true)`
4. **Criar função `handleTestSend`**: chama `supabase.functions.invoke('send-whatsapp', { body: { telefone: testPhone, mensagem: 'mensagem teste', uazapi_server_url, uazapi_instance_token } })` e exibe toast de sucesso/erro
5. **Adicionar o Dialog** com:
   - Todo o conteúdo que hoje está na aba `config` (configuração UAZAPI para não-admin, mensagem Z-API para admin)
   - Novo bloco "Testar envio" com campo de telefone + botão
6. **Remover a aba config** da renderização inline (já que agora vive dentro do Dialog)
7. **Remover referências a `activeTab === 'config'`** que controlavam a exibição inline

### Resultado visual do Dialog
- Título: "Configurações"
- Campos Server URL e Instance Token (existentes)
- Botões Salvar/Testar conexão (existentes)
- Separador
- Campo "Telefone para teste" + Botão "Testar envio"

