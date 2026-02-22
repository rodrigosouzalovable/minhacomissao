

# Corrigir Duplicidade de Parcelas de Acordo na Tabela de Devedores

## Problema Identificado

A importacao "UME NOVO MUNDO 5.xlsx" inseriu na tabela `devedores` tanto as parcelas originais das dividas quanto as parcelas dos acordos ja negociados internamente. Isso faz com que o portal publico exiba registros duplicados/incorretos para esses clientes.

- Caso Stefanne: 14 parcelas originais (R$ 144,00) + 15 parcelas do acordo (R$ 134,40) = 29 registros ao inves dos 14 corretos
- **229 acordos ativos** potencialmente afetados por esse problema

## Solucao em Duas Frentes

### Frente 1: Limpeza dos dados duplicados

Desativar (`ativo = false`) os registros de devedores que correspondem a parcelas de acordos ja lancados. A identificacao sera feita cruzando:
- CPF normalizado igual entre `devedores` e `acordos`
- `valor_atualizado` do devedor igual ao `valor_parcela` do acordo
- `data_vencimento` do devedor >= `data_primeiro_pagamento` do acordo
- Acordo com status 'ativo' ou 'concluido'

Sera executada uma query SQL para marcar esses registros como `ativo = false`, preservando o historico sem deletar dados.

### Frente 2: Prevencao no portal (ja implementado parcialmente)

A funcao `consultar_acordo_ativo_por_cpf` implementada anteriormente ja bloqueia a negociacao para CPFs com acordo ativo. Porem, o portal ainda exibe todos os registros de devedores, incluindo os incorretos. A melhoria sera:

- Alterar a funcao `consultar_debitos_por_cpf` ou a logica do frontend para filtrar registros que correspondam a parcelas de acordos ativos
- Garantir que o saldo exibido reflita apenas a divida original, nao as parcelas do acordo

## Detalhes Tecnicos

### Migration SQL - Limpeza de dados

```sql
-- Desativar registros de devedores que sao parcelas de acordos ja lancados
UPDATE devedores d
SET ativo = false, atualizado_em = now()
WHERE d.ativo = true
AND EXISTS (
  SELECT 1 FROM acordos a
  WHERE cpf_normalize(a.cliente_cpf) = cpf_normalize(d.cpf)
    AND a.status IN ('ativo', 'concluido')
    AND d.valor_atualizado = a.valor_parcela
    AND d.data_vencimento >= a.data_primeiro_pagamento
);
```

### Alteracao no frontend (ConsultaResultado.tsx)

- Quando o sistema detectar um acordo ativo (via `consultar_acordo_ativo_por_cpf`), o portal ja exibe o banner de bloqueio e desabilita a negociacao, portanto os debitos exibidos sao irrelevantes nesse cenario
- Como camada extra de seguranca, nenhuma alteracao adicional no frontend e necessaria alem do que ja foi implementado

### Validacao pos-limpeza

Apos executar a migration, verificar:
1. Que a cliente Stefanne agora mostra apenas 14 registros (parcelas originais)
2. Que os 229 casos afetados foram corrigidos
3. Que o banner de "negociacao em andamento" continua aparecendo corretamente

## Riscos e Cuidados

- A query de limpeza usa `valor_atualizado = valor_parcela`, que pode ter falsos positivos em casos onde o valor da parcela do acordo coincide com o valor original da divida. Para mitigar, o filtro de `data_vencimento >= data_primeiro_pagamento` reduz significativamente esse risco
- Os dados nao serao deletados, apenas marcados como `ativo = false`, permitindo reversao se necessario
- Recomenda-se revisar manualmente alguns casos apos a execucao para validar a correcao

