

# Melhorias no Acionamento — URL padrão + desativação automática

## 1. URL pré-definida no formulário de nova instância

**Arquivo:** `src/pages/Acionamento.tsx` (linha 969)

Ao clicar em "Adicionar", o `server_url` já virá preenchido com `https://certificadoracnpj.uazapi.com`:

```typescript
setEditingInstance({ nome: '', server_url: 'https://certificadoracnpj.uazapi.com', instance_token: '' })
```

## 2. Desativação automática de instância com falha de envio

**Arquivo:** `src/hooks/useAutoSend.tsx`

No `catch` da função `sendSingle`, quando ocorre erro de envio e a config é UAZAPI, contar erros consecutivos por instância. Após **3 erros consecutivos** na mesma instância, desativá-la automaticamente no banco (`ativo = false`) e exibir toast de aviso.

Implementação:
- Adicionar um `ref` para rastrear erros consecutivos por `server_url + instance_token`
- No `catch`: incrementar contador. Se ≥ 3, chamar `supabase.from('user_whatsapp_instances').update({ ativo: false })` filtrando pelo token
- No sucesso: zerar o contador daquela instância
- Remover a instância desativada do array de configs em uso para que o round-robin pule para a próxima
- Toast: `"WhatsApp {nome} desativado automaticamente após falhas consecutivas"`

### Arquivos alterados
- `src/pages/Acionamento.tsx` — valor padrão do server_url
- `src/hooks/useAutoSend.tsx` — lógica de desativação automática por falhas consecutivas

