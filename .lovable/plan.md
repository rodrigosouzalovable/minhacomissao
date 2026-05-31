# Corrigir cards 03 · Eficiência de Recuperação e 04 · Saúde dos Acordos (Comitê Novo Mundo)

## Diagnóstico

Os cards mostram tudo zerado, mas os dados existem na base e batem com a carteira Novo Mundo já importada:

| Métrica (consulta direta) | Valor real | Card hoje |
|---|---|---|
| Acordos ativos (CPFs da carteira NM) | **1.132** | 0 |
| Quebrados | **122** | 0 |
| Fechados em maio/2026 | **544** | 0 |
| Pagamentos pagos em maio/2026 | **122** parcelas | R$ 0,00 |
| Risco total da carteira | R$ 111.850.277,62 | R$ 111.850.277,62 ✅ |

O risco aparece porque vem de outra função (`comite_carteira_nm_agregar`). Os zeros vêm da função `comite_carteira_nm_kpis_extras`, que está retornando vazio mesmo havendo dados.

**Causa raiz:** a função usa `CREATE TEMP TABLE IF NOT EXISTS ... ON COMMIT DROP` para 4 tabelas temporárias. No pooler do Supabase (transaction mode), em chamadas repetidas na mesma conexão, o `IF NOT EXISTS` ignora o `AS SELECT` quando a tabela ainda está "viva" sob outro snapshot — resultando em tabelas vazias e, consequentemente, todos os contadores em zero. É um padrão conhecido de ser instável em PostgREST.

## O que vai ser feito

Reescrever apenas a função `comite_carteira_nm_kpis_extras` trocando as 4 TEMP TABLES por **CTEs** (`WITH ...`) dentro de uma única consulta agregada. Mesma assinatura, mesmo formato JSON de retorno — o frontend não muda.

Blocos preservados, sem mudança semântica:
- **Recuperação:** `pago_mes_total`, `pago_mes_qtd`, `pct_sobre_risco`, `por_faixa` (pago vs risco por faixa), `serie_6meses`.
- **Saúde dos acordos:** `ativos_qtd`, `quebrados_qtd`, `quitados_qtd`, `fechados_mes`, `quebrados_mes`, `taxa_quebra`, `em_risco_qtd`, `em_risco_valor` (parcelas pendentes vencendo nos próximos 7 dias).
- **Cobertura:** `total_cpfs`, `cpfs_acionados_mes`, `pct_acionados`, `cpfs_convertidos`, `pct_convertidos`, `cpfs_intocados_30d_qtd`.

## Detalhes técnicos

- Migration única que faz `CREATE OR REPLACE FUNCTION public.comite_carteira_nm_kpis_extras(p_mes_ano text)` com a mesma checagem `is_admin_user` e mesmo `jsonb_build_object` de saída.
- CTEs internos: `cart_cpfs` (CPFs distintos da carteira ativa + faixa + risco), `risco_faixa`, `acordos_nm` (acordos cujo `cpf_normalize(cliente_cpf)` está em `cart_cpfs`), `phones` (devedores Novo Mundo com telefone normalizado para sufixo de 8 dígitos), `acionados_mes` e `acionados_30d` (CPFs com envio em `whatsapp_mensagens` direção `saida` nos respectivos períodos, casando pelo sufixo do telefone).
- Sem mudanças em tabelas, RLS, índices, edge functions, cron ou frontend. Sem impacto em custo Lovable Cloud.
- `comite_carteira_nm_intocados` continua igual (já usa CTE), nada a mexer.

## Risco e validação

- Risco: nulo — função `STABLE SECURITY DEFINER` apenas leitura, mesma interface pública.
- Validação: após aplicar, abrir a aba Comitê Novo Mundo no mês 2026-05 e conferir que os cards 03/04/05 exibem os números acima (≈1.132 ativos, 122 quebrados, 544 fechados no mês, valor pago do mês > 0, % recuperado > 0).
