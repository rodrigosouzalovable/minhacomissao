

# Diagnóstico: "Sem nome" e apenas 12 de 34

## Problema 1: "Sem nome"
A coluna `cliente_nome` na tabela `whatsapp_fila` foi adicionada agora. Os 12 registros existentes foram inseridos ANTES da migração, então o campo está NULL. Solução: atualizar os registros antigos com os nomes dos acordos associados via SQL.

## Problema 2: Apenas 12 de 34
A edge function `check-payment-reminders` tem filtros que excluem parcelas:
- **Linha 157**: Exige que o acordo tenha **pelo menos uma parcela já paga**. Parcelas de acordos onde nenhuma parcela foi paga são ignoradas. Muitas das 34 pendências do sino são de acordos com parcela 1 pendente (nunca paga), então são puladas.
- **Deduplicação**: Se já existe na `whatsapp_fila` ou `whatsapp_lembretes_log`, pula.
- **Status do acordo**: Só processa acordos com status `ativo`.

O filtro de "pelo menos uma parcela paga" é o principal causador da diferença.

## Plano de correção

### 1. Migration: Preencher `cliente_nome` nos registros antigos
```sql
UPDATE whatsapp_fila f
SET cliente_nome = a.cliente_nome
FROM pagamentos p
JOIN acordos a ON a.id = p.acordo_id
WHERE f.pagamento_id = p.id
AND f.cliente_nome IS NULL;
```

### 2. Edge Function: Remover filtro de parcela paga
Remover as linhas 149-157 que exigem que o acordo tenha pelo menos uma parcela paga. Se a parcela está pendente e o acordo está ativo, o lembrete deve ser enviado independentemente de haver parcela paga anteriormente. Isso fará com que todas as 34 pendências do sino sejam processadas.

### 3. Frontend: Melhorar label dinâmico de tipos de lembrete
Atualizar o `tipoLembreteLabel` no `LembretesSection.tsx` para gerar labels dinâmicos para qualquer `vencido_dX` (ex: "D+5", "D+19") em vez de mostrar o texto bruto.

