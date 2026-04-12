

## Salvar contatos na agenda do WhatsApp (telefone físico)

### Situação
Atualmente, os contatos são salvos apenas no **banco de dados** da plataforma (tabela `whatsapp_contatos`). Isso faz com que apareçam no Inbox do sistema, mas **não no telefone físico** — no WhatsApp do aparelho, o número aparece sem nome salvo.

### Solução
A UAZAPI possui um endpoint `Contact:Add` que permite salvar contatos diretamente na agenda do WhatsApp do dispositivo. Vamos adicionar uma função que chama esse endpoint sempre que uma conversa de aquecimento é iniciada.

### Alteração em `supabase/functions/whatsapp-ia-responder/index.ts`

#### 1. Nova função `salvarContatoUAZAPI`
Criar função que chama o endpoint `/contact/add` da UAZAPI para salvar o contato na agenda do telefone:
```typescript
async function salvarContatoUAZAPI(serverUrl, instanceToken, numero, nome) {
  // Tenta endpoints: /contact/add, /contacts/add
  // Envia: { number: "5562...", name: "Nome" }
}
```

#### 2. Chamar na action `iniciar-conversa`
Após criar a conversa, salvar o contato em ambos os lados:
- Instância de origem salva o número de destino na agenda do telefone
- Instância de destino salva o número de origem na agenda do telefone

Usar o nome da instância (ex: "62982451153 25 N1 07/04") ou um nome amigável extraído.

#### 3. Chamar no `logToInbox` quando cria contato novo
Quando o `logToInbox` cria um contato novo no banco, também salvar na agenda do telefone.

### Arquivo Modificado
- `supabase/functions/whatsapp-ia-responder/index.ts`

### Resultado
Quando uma conversa de aquecimento é iniciada, ambos os telefones terão o contato do outro salvo automaticamente na agenda do WhatsApp.

