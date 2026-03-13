

# Plano: Automação para TODAS as parcelas pendentes do sino

## Problema identificado

O sino mostra **34 pendências** (todas as parcelas vencidas + hoje + 3 dias), mas a automação `check-payment-reminders` só envia mensagens para parcelas vencidas em dias específicos da cadência: D+1, D+2, D+10, D+11, D+20, D+30.

Parcelas vencidas há 3, 4, 5, 6, 7, 8, 9, 12-19, 21-29 dias **não recebem nenhuma mensagem**. Por isso dos 34 do sino, muitos ficam sem envio.

## Solução

Alterar a função `check-payment-reminders` para buscar **TODAS** as parcelas vencidas pendentes (não apenas datas específicas), mantendo a lógica de deduplicação existente (não reenvia se já existe na fila ou no log).

### Alterações

**1. Edge Function `check-payment-reminders/index.ts`**
- Substituir a query de vencidas (que usa `.in('data_prevista', todasDatasVencidas)`) por `.lt('data_prevista', hojeStr)` para pegar TODAS as vencidas
- Calcular dinamicamente o `tipo_lembrete` baseado nos dias de atraso (ex: `vencido_d3`, `vencido_d15`, etc.)
- Para dias que não têm template específico (ex: D+3 a D+9), usar uma mensagem genérica de cobrança
- Manter os templates existentes para D+1, D+2, D+10, D+11, D+20, D+30
- A deduplicação por `pagamento_id + tipo_lembrete` garante que cada parcela só recebe UMA mensagem por dia de atraso

**2. Template genérico para dias sem mensagem específica**
Para os dias intermediários (D+3 a D+9, D+12 a D+19, D+21 a D+29, D+31+), usar:
> "Olá {nome}, aqui é {funcionario}, do departamento de acordos das Lojas Novo Mundo. Sua parcela no valor de {valor} com vencimento em {data} encontra-se em atraso há {X} dias. Por favor, regularize o pagamento ou entre em contato."

### Resultado
- Todas as 34 pendências do sino terão mensagem enviada
- Cada parcela recebe no máximo 1 mensagem por dia de atraso (deduplicação existente)
- Templates específicos continuam funcionando nos dias D+1, D+2, D+10, D+11, D+20, D+30

