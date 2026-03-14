

# Remover seção "WhatsApp Principal para Lembretes"

## Alterações

### `src/pages/Acionamento.tsx`
- Remover o import de `LembretesSection` e `LembreteMensagensDialog`
- Remover os estados `selectedLembreteInstanceId`, `savingLembrete` e a função `handleSaveLembreteInstance`
- Remover o `useEffect` que faz match do perfil com instância de lembretes (linhas ~289-298)
- Remover o bloco `<Separator />` + `<LembretesSection ... />` (linhas 1762-1770)

### `src/components/LembretesSection.tsx`
- Deletar o arquivo inteiro

### Limpeza adicional
- Verificar se `LembreteMensagensDialog` é usado em outro lugar; se não, deletar também
- Remover a lógica de salvar `whatsapp_lembrete_server_url` / `whatsapp_lembrete_instance_token` no perfil (dentro de `handleSaveLembreteInstance`)

