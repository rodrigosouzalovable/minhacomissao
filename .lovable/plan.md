## Problema

O botão **"Testar instâncias"** sempre retorna "0 passaram, 1 falharam" e nenhuma linha aparece em "Últimos envios". A causa são duas restrições da tabela `meta_lembrete_log` que quebram o insert do teste:

1. `pagamento_id` é `NOT NULL` — o teste passa `null` e o insert explode.
2. Check `tipo IN ('D-3','D0')` — o valor `'teste'` é rejeitado.

Quando o insert de log falha, a edge function `meta-lembrete-teste-instancias` lança exceção e devolve `ok:false`, mesmo se o `send-whatsapp-meta` real tiver funcionado. Além disso, hoje o erro de envio real fica escondido porque o insert falha antes do resultado voltar limpo para a UI.

## Correção

Mudança mínima, só no fluxo de teste (não mexe no cron 08:30 nem no dry-run).

### 1. Migration
- `ALTER TABLE meta_lembrete_log ALTER COLUMN pagamento_id DROP NOT NULL`.
- Substituir o check `tipo IN ('D-3','D0')` por `tipo IN ('D-3','D0','teste')`.
- Ajustar a `UNIQUE (pagamento_id, tipo, data_ref)` para não bloquear múltiplos testes no mesmo dia (unique parcial: só quando `pagamento_id IS NOT NULL`), preservando a deduplicação real dos lembretes D-3/D0.

### 2. Edge function `meta-lembrete-teste-instancias`
- Envolver o `insert` em try/catch — falha de log **nunca** deve derrubar o resultado do teste.
- Continuar registrando no log quando possível (agora com `tipo='teste'` válido), para o histórico "Últimos envios" mostrar os testes.
- Garantir que o `resultados[]` reflita o resultado real do `send-whatsapp-meta`, incluindo mensagem de erro clara (ex.: template não aprovado, telefone inválido, instância sem token).

### 3. Frontend `src/pages/LembreteMeta.tsx`
- Nenhuma mudança de layout. Só assegurar que o tooltip/rodapé do badge ❌ mostre o `erro` que a função devolver, para você conseguir diagnosticar quando falhar.

## Fora do escopo
- Alterar cron 08:30, dry-run, template fixo `lembrete_envio_boleto` ou notificação admin.
- Refatorar `send-whatsapp-meta`.
