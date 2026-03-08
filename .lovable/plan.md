

# Bloquear chatbot para instâncias desativadas

## Problema
Quando uma instância UAZAPI é desativada (`ativo = false`), a query na linha 602 filtra por `ativo = true`, resultando em `instanceOwner = null`. O código pula o bloco de verificação e continua processando a mensagem normalmente — o chatbot continua respondendo.

## Solução
Adicionar uma segunda query (sem filtro `ativo`) para verificar se a instância existe mas está desativada. Se estiver, retornar silenciosamente sem responder.

### Alteração em `supabase/functions/whatsapp-chatbot/index.ts` (linhas ~597-632)

Após a query atual que busca instância ativa, adicionar:

```typescript
if (instanceToken) {
  // First check if instance exists but is deactivated
  const { data: instanceRecord } = await supabase
    .from('user_whatsapp_instances')
    .select('user_id, ativo')
    .eq('instance_token', instanceToken)
    .limit(1)
    .maybeSingle();

  if (instanceRecord && !instanceRecord.ativo) {
    console.log(`[CHATBOT] Instance ${instanceToken} is deactivated, ignoring.`);
    return new Response(JSON.stringify({ success: true, ignored: true, reason: 'instance_deactivated' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (instanceRecord?.user_id) {
    // existing admin role check...
    // existing lembretes check...
  }
}
```

Isso substitui a query dupla atual por uma única query sem filtro de `ativo`, verificando o status manualmente.

## Arquivo alterado
- `supabase/functions/whatsapp-chatbot/index.ts`

