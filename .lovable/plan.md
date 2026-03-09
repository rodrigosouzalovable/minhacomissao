

# Plano: Admin responde por número de telefone direto

## Problema atual
O fluxo admin-in-the-loop só funciona quando existe um registro `admin_pending_{instanceToken}` — ou seja, apenas para o último cliente que gerou dúvida naquela instância. Se o admin recebe a notificação e responde algo como "Responda ao numero 556493097974 com a proposta", o sistema não consegue:
1. Extrair o número do telefone da instrução
2. Encontrar a conversa correta (`chatbot_conversas`) daquele cliente
3. Executar a instrução no contexto correto

## Solução

**Arquivo**: `supabase/functions/whatsapp-chatbot/index.ts`

### 1. Nova função `parseAdminInstructionWithTarget`
Extrair número de telefone alvo da instrução do admin usando regex:
```typescript
function parseAdminInstructionWithTarget(texto: string): { telefoneAlvo: string | null; instrucao: string } {
  // Detecta padrões como "Responda ao numero 556493097974 com a proposta"
  // ou "Envie para 62993097974: ..."
  const match = texto.match(/(?:responda|envie?|mande?|fale?).*?(?:numero|número|n[uú]m|para|ao)\s*(\d{10,13})\s*(?:com|:|\s)?\s*(.*)/i);
  if (match) {
    let tel = match[1].replace(/\D/g, '');
    if (tel.length === 11) tel = '55' + tel; // normalizar
    return { telefoneAlvo: tel, instrucao: match[2].trim() };
  }
  return { telefoneAlvo: null, instrucao: texto };
}
```

### 2. Alterar interceptação do admin (linha ~677-835)
Antes de buscar `admin_pending`, tentar extrair telefone alvo da mensagem. Se encontrar:

1. Buscar `chatbot_conversas` pelo telefone alvo
2. Carregar o contexto/dados daquela conversa
3. Usar `gerarRespostaComInstrucaoAdmin` com a instrução (ex: "com a proposta" → IA gera a proposta financeira completa)
4. Seguir o fluxo existente: enviar proposta ao admin para confirmação → aguardar "sim" → enviar ao cliente
5. Registrar aprendizado na `chatbot_regras`

Se a instrução contiver "proposta", buscar os dados financeiros (`valor_avista`, `valor_parcelado`) do `dados` da conversa e gerar a mensagem de proposta diretamente com `gerarMensagemProposta()`.

### 3. Fluxo resultante

```text
Admin recebe: "o cliente respondeu 'Me envia pfv'"
Admin responde: "Responda ao numero 556493097974 com a proposta"
                         ↓
Sistema extrai: telefone=556493097974, instrução="com a proposta"
                         ↓
Busca chatbot_conversas WHERE telefone='556493097974'
                         ↓
Detecta "proposta" → gera mensagem de proposta com valores
                         ↓
Admin recebe: 'Ok, irei responder: "Que ótimo! 🎉..." Confirma?'
                         ↓
Admin: "Sim"
                         ↓
Envia ao cliente + registra aprendizado + desbloqueia conversa
```

### 4. Compatibilidade
- O fluxo existente com `admin_pending` continua funcionando como fallback
- Se o admin não especificar número, usa o `admin_pending` como hoje

