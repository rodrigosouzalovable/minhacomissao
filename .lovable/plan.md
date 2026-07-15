## Objetivo

Em cada card de instância na aba **API Oficial Meta** (`/admin/configurar-meta`):
1. Botão para abrir direto a página de **Atividade de pagamento** da instância no Meta Business.
2. Campo para **importar PDF** de fatura → extrai `valor`, `número de referência`, `data da transação` → grava no histórico da instância → PDF é descartado (não fica no storage).
3. **Somatório total** de todos os pagamentos importados exibido em card no topo, atualizado automaticamente.

## Backend (nova tabela)

Criar `meta_instance_pagamentos`:
- `instance_id` (FK → `meta_whatsapp_instances`)
- `user_id`
- `valor_usd` (numeric)
- `valor_brl` (numeric, opcional — convertido via `cotacoes_moedas` do dia)
- `numero_referencia` (text, único por instância — evita duplicata na reimportação)
- `data_transacao` (date)
- `criado_em`

Com RLS: admin lê/insere/apaga todos; usuário comum só vê os seus.

## Edge function: `parse-meta-invoice-pdf`

- Recebe o PDF em base64 (client-side lê o arquivo, converte, envia).
- Usa `pdf-parse` ou extração via regex sobre o texto extraído (o PDF anexado é texto puro, não escaneado):
  - `Data da transação` → linha seguinte contém a data em pt-BR (`9 de jul de 2026`) → converte p/ ISO.
  - `Número de referência:` → captura o token alfanumérico.
  - `US$X,YY` na região "Pago" → captura valor USD.
- Retorna `{ valor_usd, numero_referencia, data_transacao }`.
- Não persiste o PDF em lugar nenhum.

## Frontend — `src/pages/ConfigurarMeta.tsx`

### Card totalizador (topo, acima da lista de instâncias)
- Mostra: **Total gasto (USD) e (BRL)** = soma de `valor_usd` de todos os registros do usuário.
- Mostra também total por instância no próprio card da instância.

### Em cada card de instância
- **Botão "Ver faturamento no Meta"** → abre em nova aba:
  `https://business.facebook.com/latest/billing_hub/payment_activity/?business_id={business_id}&asset_id={waba_id}&placement=BILLING_HUB_WHATSAPP_ACCOUNT_LIST`
  Se `business_id` estiver vazio, botão desabilitado com tooltip "Preencha o Business ID".
- **Botão "Importar fatura (PDF)"** → abre `<input type="file" accept="application/pdf">`:
  1. Lê arquivo → base64 (sem upload para storage).
  2. Chama `parse-meta-invoice-pdf` edge function.
  3. Mostra diálogo de confirmação com os 3 valores extraídos (editáveis, caso o parse erre).
  4. Ao confirmar → insert em `meta_instance_pagamentos` (upsert por `numero_referencia` para evitar duplicata).
  5. Toast de sucesso + refetch do total.
- **Mini-histórico no card**: expansível ("Ver pagamentos importados") mostrando lista com data, referência, valor — com opção de apagar cada registro.

## Detalhes técnicos

- Hook novo `useMetaInstancePagamentos(instance_id?)` com React Query: retorna lista + total.
- Query global no topo usa `staleTime: 60_000` e invalida ao inserir/deletar.
- Nenhuma alteração em lógica de envio Meta ou billing existente (`meta_billing_snapshot` continua intocado — este é um controle manual paralelo do usuário).

## Arquivos afetados
- Migration nova (tabela + RLS + grants).
- `supabase/functions/parse-meta-invoice-pdf/index.ts` (nova).
- `supabase/config.toml` (registrar função, `verify_jwt = true`).
- `src/hooks/useMetaInstancePagamentos.ts` (novo).
- `src/pages/ConfigurarMeta.tsx` (card totalizador + botões por instância + diálogo de confirmação).
