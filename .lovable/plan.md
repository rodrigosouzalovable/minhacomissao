# Ignorar faturas "Pendente" nos cards de instância

## Objetivo
Parar de contabilizar as autorizações de verificação de US$25 "Pendente" da Meta como despesa real. Elas costumam cair (estorno) em 5-15 dias e não representam consumo.

## O que muda

### 1. Parser de PDF (`supabase/functions/parse-meta-invoice-pdf/index.ts`)
- Extrair também o campo **status do pagamento** ("Pendente" / "Aprovado" / "Pago" / "Falhou" / "Cancelado").
- Retornar `status` normalizado no JSON de resposta (`aprovado` | `pendente` | `falhou`).

### 2. Tabela `meta_instance_pagamentos`
- Adicionar coluna `status text default 'aprovado'` (via migration).
- Backfill: registros já existentes ficam como `'aprovado'` (não mexer no histórico já importado).

### 3. Importação no card da instância (`src/pages/ConfigurarMeta.tsx` + `useMetaInstancePagamentos`)
- Ao importar, se o parser retornar `status = 'pendente'`:
  - Salvar mesmo assim, mas com `status='pendente'`.
  - Mostrar toast de aviso: "Fatura pendente detectada — provável verificação de cartão (US$25). Não será somada ao total até virar Aprovada."
- Se `aprovado` ou `pago` → salva normal.
- Se `falhou`/`cancelado` → toast de erro e não salva.

### 4. Totais nos cards e no topo (`ConfigurarMeta.tsx` + `MetaBillingConciliacaoCard.tsx`)
- Somatório do topo e "Faturas importadas" por instância passam a **somar apenas `status='aprovado'`**.
- Exibir linha separada "Pendentes: US$ X,XX (N)" em cinza, com tooltip explicando que são holds de verificação da Meta.
- Conciliação usa apenas aprovadas para calcular diferença.

### 5. UI de gestão de pagamentos por instância
- Na lista de faturas importadas do card, badge visual: `Aprovada` (verde) / `Pendente` (âmbar).
- Botão "Marcar como aprovada" para forçar promoção manual caso o usuário confirme que a Meta efetivou depois.

## Fora de escopo
- Não alterar `meta_billing_snapshot` (billing oficial da Meta já é fonte separada).
- Não criar cron para reverificar status na Meta — promoção é manual por ora.

## Detalhes técnicos
- Migration adiciona coluna + índice parcial `where status='aprovado'` para acelerar somatórios.
- Regex do parser procura por "Pendente" / "Aprovado" / "Pago" próximo ao "Status do pagamento" na página extraída.
- Fallback: se não detectar status, assumir `aprovado` (comportamento atual) para não quebrar imports antigos.
