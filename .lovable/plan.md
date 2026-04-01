

## Corrigir mensagens enviadas não aparecendo no Inbox

### Problema
Quando o usuário envia uma mensagem pelo Inbox, ela não aparece na conversa até o destinatário responder. O sistema depende exclusivamente do realtime para exibir a mensagem enviada, mas o evento pode não chegar ao cliente por questões de timing ou avaliação de RLS.

### Solução
Duas correções no arquivo `src/pages/WhatsAppInbox.tsx`:

1. **Mensagem otimista**: Ao enviar com sucesso, adicionar a mensagem imediatamente ao estado local (`setMensagens`) sem esperar o realtime. Isso garante que a mensagem apareça instantaneamente.

2. **Re-fetch após envio**: Após o envio bem-sucedido, chamar `fetchMensagens()` para sincronizar com o banco e garantir que o estado local reflita o que está salvo.

3. **Proteção contra duplicação no realtime**: Ao receber um INSERT via realtime, verificar se a mensagem já existe no estado local (pelo `id`) antes de adicioná-la, evitando duplicatas causadas pelo otimismo + realtime.

### Arquivo alterado
- `src/pages/WhatsAppInbox.tsx`

### Detalhes técnicos

Na função `handleEnviarTexto`, após envio com sucesso:
```tsx
// Adicionar mensagem otimista ao estado local
const msgOtimista: Mensagem = {
  id: `temp-${Date.now()}`,
  instancia_id: contatoAtivo.instancia_id,
  telefone_remoto: contatoAtivo.telefone,
  conteudo: texto,
  direcao: 'saida',
  timestamp_msg: new Date().toISOString(),
  lida: true,
  nome_contato: null,
};
setMensagens(prev => [...prev, msgOtimista]);

// Re-fetch para sincronizar com DB
setTimeout(() => fetchMensagens(), 1500);
```

No listener de realtime, evitar duplicatas:
```tsx
setMensagens(prev => {
  if (prev.some(m => m.id === newMsg.id)) return prev;
  // Remove mensagem otimista temporária se existir
  const filtered = prev.filter(m => !m.id.startsWith('temp-'));
  return [...filtered, newMsg];
});
```

