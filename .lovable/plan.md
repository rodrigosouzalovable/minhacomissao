

# Restringir chatbot IA apenas para instâncias de admin

## Problema
Atualmente, o chatbot responde em qualquer instância UAZAPI onde o dono tem `whatsapp_lembretes_habilitado = true`. O usuário quer que a IA responda apenas em instâncias pertencentes a usuários com role `admin`.

## Solução
No arquivo `supabase/functions/whatsapp-chatbot/index.ts`, no bloco de verificação do dono da instância (linhas 576-597), adicionar uma checagem na tabela `user_roles` para verificar se o dono é admin. Se não for admin, ignorar o webhook silenciosamente.

### Alteração (linhas 585-596)
Após encontrar o `instanceOwner.user_id`, verificar se esse user tem role `admin` na tabela `user_roles`:

```typescript
if (instanceOwner?.user_id) {
  // Check if owner is admin - chatbot only works for admin instances
  const { data: ownerRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', instanceOwner.user_id)
    .eq('role', 'admin')
    .maybeSingle();

  if (!ownerRole) {
    console.log(`[CHATBOT] Instance owner ${instanceOwner.user_id} is not admin, ignoring.`);
    return new Response(JSON.stringify({ success: true, ignored: true, reason: 'owner_not_admin' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Existing lembretes check
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('whatsapp_lembretes_habilitado')
    .eq('id', instanceOwner.user_id)
    .single();
  if (ownerProfile && !ownerProfile.whatsapp_lembretes_habilitado) {
    return ...;
  }
}
```

## Arquivo alterado
- `supabase/functions/whatsapp-chatbot/index.ts`

