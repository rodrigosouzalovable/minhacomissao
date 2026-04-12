

## Salvar contatos automaticamente ao iniciar conversa de aquecimento

### Situação Atual
- O `logToInbox` no `whatsapp-ia-responder` salva mensagens mas **NÃO cria contatos** na tabela `whatsapp_contatos` se eles não existirem
- Os contatos são criados pelo webhook quando mensagens chegam — mas isso depende do webhook estar funcionando
- Se o contato não existir, a mensagem é salva com o telefone correto mas não aparece na sidebar do Inbox

### Solução
Atualizar a função `logToInbox` no `whatsapp-ia-responder` para criar o contato automaticamente (upsert) caso não exista. Quando uma conversa de aquecimento é iniciada, garantir que ambos os lados tenham o contato do outro salvo.

#### Alteração em `whatsapp-ia-responder/index.ts` — função `logToInbox`
Após buscar o contato existente, se não encontrar, criar um novo registro em `whatsapp_contatos` com:
- `instancia_id`: a instância que está enviando/recebendo
- `telefone`: o número remoto (formato limpo)
- `nome`: extraído do nome da instância destino (se disponível) ou o próprio número

```typescript
// Na função logToInbox, após o maybeSingle():
if (!contato) {
  // Criar contato automaticamente
  const { data: newContato } = await sb.from("whatsapp_contatos").insert({
    instancia_id: instanciaId,
    telefone: cleanPhone,
    nome: cleanPhone, // será atualizado pelo webhook depois
    ultima_mensagem: texto.slice(0, 200),
    ultima_mensagem_em: new Date().toISOString(),
  }).select("id, telefone").single();
  
  if (newContato) phoneToStore = newContato.telefone;
}
```

#### Melhoria adicional na action `iniciar-conversa`
Após iniciar a conversa, salvar o contato em ambos os lados:
- Na instância de origem: salvar o número de destino
- Na instância de destino: salvar o número de origem

Isso garante que mesmo antes de qualquer webhook disparar, ambos os contatos já existem.

### Arquivo Modificado
- `supabase/functions/whatsapp-ia-responder/index.ts` — `logToInbox` cria contato se não existir + `iniciar-conversa` garante contatos em ambos os lados

### Resultado
Toda conversa de aquecimento criará automaticamente os contatos em ambas as instâncias, garantindo visibilidade imediata no Inbox.

