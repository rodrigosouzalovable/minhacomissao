

## Exibir foto de perfil do WhatsApp no card de cada instância

### Contexto
A coluna `whatsapp_profile_photo_url` já existe na tabela `user_whatsapp_instances` e já é carregada no estado. Basta exibir a imagem no card.

### Alteração: `src/pages/Acionamento.tsx`

Na linha ~2671, onde aparece o `<WhatsAppIcon />`, substituir por uma lógica condicional:
- Se `inst.whatsapp_profile_photo_url` existir, mostrar a foto como um avatar circular (32x32px) com `object-cover`
- Se não existir, manter o `<WhatsAppIcon />` como fallback

```tsx
{(inst as any).whatsapp_profile_photo_url ? (
  <div className="h-8 w-8 rounded-full overflow-hidden shrink-0 border">
    <img src={(inst as any).whatsapp_profile_photo_url} alt="" className="h-full w-full object-cover" />
  </div>
) : (
  <WhatsAppIcon />
)}
```

### Resultado
Cada instância mostrará a foto do perfil do WhatsApp diretamente no card, sem precisar abrir a edição.

