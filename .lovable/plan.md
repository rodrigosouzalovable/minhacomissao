

## Corrigir ordem de envio nas Campanhas de Voz

### Problema identificado
Na função `handleStartCampaign` (linha 393 de `CampanhasVoz.tsx`), a busca dos contatos pendentes **não tem `order`**:

```typescript
.from('voice_campaign_contacts')
.select('*')
.eq('campaign_id', campaign.id)
.eq('status', 'pendente')
// ← falta .order('created_at', { ascending: true })
```

Resultado: o banco retorna os contatos em ordem indefinida, então o envio acontece fora da sequência mostrada na tabela (que usa `order created_at asc`). Isso causa a impressão de que contatos estão sendo "pulados".

### Correção

**Arquivo: `src/pages/CampanhasVoz.tsx`**

Adicionar `.order('created_at', { ascending: true })` na query de contatos pendentes dentro de `handleStartCampaign`, garantindo que o envio siga a mesma ordem exibida na tabela.

É uma alteração de 1 linha. Nenhuma mudança no banco de dados é necessária.

