

# Enviar mensagem de CPF inválido apenas uma vez

## Problema
Quando o bot está na etapa `aguardando_cpf` e o cliente envia mensagens que não contêm CPF (áudios, textos livres como "Mano", "A mesma coisa q eu fazia antes"), o bot repete a mensagem "Não consegui identificar um CPF válido..." a cada mensagem recebida — irritando o cliente.

## Solução
Adicionar um contador `tentativas_cpf` nos `dados` da conversa. Na primeira falha, enviar a mensagem de CPF inválido. Na segunda falha, silenciar e transferir para atendimento humano (`aguardando_humano`), notificando o admin.

### Alteração em `whatsapp-chatbot/index.ts` (linhas 778-783)

```typescript
// Waiting for CPF input
const cpf = extractCpf(texto);
if (!cpf) {
  const tentativasCpf = (dados.tentativas_cpf || 0) + 1;
  dados = { ...dados, tentativas_cpf: tentativasCpf };
  
  if (tentativasCpf <= 1) {
    resposta = `Não consegui identificar um CPF válido. Por favor, envie seu CPF com 11 dígitos. Exemplo: 123.456.789-00`;
    await salvarEResponder('aguardando_cpf');
  } else {
    // Já pediu uma vez — transferir para humano silenciosamente
    await salvarSilenciosoENotificar('aguardando_cpf', texto);
  }
  break;
}
```

## Arquivo alterado
- `supabase/functions/whatsapp-chatbot/index.ts`

