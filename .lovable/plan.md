

# Diagnóstico: Apenas 12 de 167 parcelas processadas

## Causa raiz: Timeout da Edge Function

A edge function `check-payment-reminders` processa **627 parcelas** de todos os usuarios. Para **cada parcela**, faz 3-4 queries sequenciais ao banco:
1. Buscar perfil do usuario
2. Buscar instancia WhatsApp
3. Verificar duplicidade na `whatsapp_fila`
4. Verificar duplicidade no `whatsapp_lembretes_log`

Isso resulta em ~2500 queries sequenciais, excedendo o timeout de 60s da edge function. A funcao processa as primeiras ~12 e morre.

Dados confirmados:
- Rodrigo tem **167 parcelas** elegiveis, apenas **11 bloqueadas** por dedup, **156 deveriam ser adicionadas**
- Apenas **12** foram de fato inseridas na fila para o token dele

## Solucao: Otimizar com queries em lote

Substituir as queries individuais por consultas em batch no inicio da funcao:

### Alteracoes na Edge Function `check-payment-reminders/index.ts`

1. **Buscar todos os perfis de uma vez** - Um unico SELECT em `profiles` com os user_ids dos acordos
2. **Buscar todas as instancias de uma vez** - Um unico SELECT em `user_whatsapp_instances` para todos os usuarios
3. **Buscar toda a fila existente de uma vez** - SELECT `pagamento_id, tipo_lembrete` da `whatsapp_fila` para todos os pagamento_ids
4. **Buscar todo o log de uma vez** - SELECT `pagamento_id, tipo_lembrete` do `whatsapp_lembretes_log` para todos os pagamento_ids
5. **Inserir em batch** - Usar `.insert([array])` ao inves de inserir um por um
6. **Verificar dedup em memoria** - Usar Sets/Maps em JS ao inves de queries individuais

```text
ANTES (por parcela):
  parcela -> query profile -> query instance -> query fila -> query log -> insert
  ~4 queries x 627 parcelas = ~2500 queries sequenciais

DEPOIS (batch):
  1x query profiles
  1x query instances  
  1x query fila (todos pagamento_ids)
  1x query log (todos pagamento_ids)
  Loop em memoria (sem queries)
  1x insert batch
  = ~5 queries total
```

### Detalhe da implementacao

- Extrair todos os `user_id` unicos dos acordos encontrados
- Fazer um SELECT em `profiles` com `.in('id', userIds)`
- Fazer um SELECT em `user_whatsapp_instances` com `.in('user_id', userIds).eq('apenas_lembretes', true)`
- Coletar todos os `pagamento_id` das parcelas encontradas
- Fazer SELECT em `whatsapp_fila` com `.in('pagamento_id', pagamentoIds)` e agrupar por `pagamento_id_tipo_lembrete`
- Fazer SELECT em `whatsapp_lembretes_log` com `.in('pagamento_id', pagamentoIds)` e agrupar igual
- Iterar em memoria, montar array de inserts, fazer um unico `.insert(batch)`
- Tratar limite de 1000 rows do Supabase: paginar os SELECTs se necessario

### Resultado esperado
- Funcao executa em <5 segundos ao inves de timeout
- Todas as 156+ parcelas do Rodrigo serao adicionadas a fila
- Todas as pendencias do sino serao cobertas

