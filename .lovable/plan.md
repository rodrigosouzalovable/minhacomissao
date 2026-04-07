

## Plano: Botão "Retomar Envio" para campanhas interrompidas

### Problema
O estado de envio vive apenas na memória (React Context). Ao atualizar a página ou sair, o loop para mas o status da campanha fica "enviando" no banco. A UI esconde o botão "Iniciar Envio" quando `status === 'enviando'` e só mostra progresso quando `sendingCampaignId` está ativo — resultado: nenhum botão aparece.

### Solução

**Arquivo: `src/pages/CampanhasVoz.tsx`**

1. Adicionar uma condição para campanhas com `status === 'enviando'` que **não** estejam sendo processadas pelo contexto (`sendingCampaignId !== selectedCampaign.id`):
   - Mostrar botão **"Retomar Envio"** que chama `handleStartCampaign` normalmente (o sistema já filtra contatos pendentes)
   - Mostrar também as opções de instância e delay, igual ao "Iniciar Envio"

2. A lógica existente de `handleStartCampaign` já busca apenas contatos com `status = 'pendente'`, então retomar funciona sem alteração no contexto.

3. Cenários cobertos:
   - Campanha "enviando" + contexto inativo → botão "Retomar Envio"
   - Campanha "enviando" + contexto ativo → mostra progresso + cancelar (já funciona)
   - Campanha outro status + contatos pendentes → botão "Iniciar Envio" (já funciona)

