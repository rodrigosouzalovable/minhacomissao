# Não enviar cobrança para quem já tem parcela paga

## O que aconteceu (confirmado nos dados)
O cliente José Sifontes (CPF 707.323.942-52, Odres Cred) tem **dois acordos ativos idênticos**, criados com 2 minutos de diferença em 07/11:
- Acordo A: parcela 1 (07/11) **pendente**
- Acordo B: parcela 1 (07/11) **paga em 07/11**

O lembrete das 09:20 olhou só o acordo A (duplicado) e cobrou a parcela de 07/11, sem perceber que a mesma parcela já estava paga no acordo B.

## Correção
1. **Verificação antes de todo envio automático de cobrança/lembrete**: antes de enviar, o sistema confere todas as parcelas do mesmo CPF (e do mesmo telefone, pelos 8 últimos dígitos) no mesmo credor. O cliente é retirado do envio quando:
   - já existe parcela **paga** com o mesmo vencimento em qualquer acordo dele; ou
   - já existe parcela **paga no mês corrente** (pela data do pagamento) para aquele credor.
2. Vale para todas as rotinas automáticas: lembrete das 09:20 (D-0/D-3/atraso), lembrete preventivo D-1, repescagem de quebrados e campanhas de atrasados.
3. Os clientes pulados ficam registrados no log do envio com o motivo "parcela já paga", para conferência.
4. **Nada é alterado nos acordos**: o acordo duplicado continua como está (desativação é sempre manual). Vou listar quantos CPFs hoje estão com acordos duplicados nessa situação para você decidir.

## Detalhes técnicos
- Novo helper `_shared/parcela-ja-paga.ts`: recebe lista de (cpf, sufixo, empresa, data_prevista), faz uma única consulta em `pagamentos` + `acordos` (status `pago`, por CPF normalizado e por credor) e retorna o conjunto a excluir. Sem nova tabela, cron ou polling — apenas uma consulta adicional por execução.
- Aplicar em `meta-lembrete-tick`, `check-payment-reminders`, `_shared/meta-atrasados-handler.ts`, `recuperacao-quebrados-auto` (inclui preventivo).
- Teste unitário: parcela paga em acordo duplicado com mesmo vencimento → excluído; pagamento no mês corrente → excluído; parcela de outro credor paga → não exclui.
