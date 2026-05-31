## Objetivo

Adicionar 3 blocos de análise à aba **Comitê Novo Mundo** que respondem à pergunta do credor *"quão eficiente está a operação sobre a carteira que entreguei?"* — **sem precisar de planilha extra**, cruzando o que já temos: snapshot da carteira (`comite_carteira_nm_item`), `acordos`, `pagamentos` e `relatorio_acionamentos`.

---

## Bloco 1 — Eficiência de Recuperação

KPIs novos no topo (linha abaixo dos cards atuais):

- **% Recuperado / Risco Total** — `total_pago_mes ÷ total_risco_carteira`.
- **% Recuperado por Faixa** — coluna nova na tabela de faixas existente (ao lado de "Risco"), mostrando quanto daquela faixa foi pago no mês.
- **Curva 6 meses** — mini-gráfico de barras com o valor recuperado mês a mês (últimos 6) só de CPFs da carteira Novo Mundo.

---

## Bloco 2 — Saúde dos Acordos Novo Mundo

Card "Acordos da Carteira" abaixo do funil:

- **Ativos / Quebrados / Quitados** (3 contadores).
- **Taxa de Quebra do mês** — `quebrados_mes ÷ fechados_mes`.
- **Em risco de quebra** — valor das parcelas vencendo nos próximos 7 dias ainda **pendentes**.

Regra de quebra: reaproveita a função existente `cpf_ultimo_acordo_quebrado` / status `quebrado` em `acordos`.

---

## Bloco 3 — Cobertura da Carteira

Card "Cobertura Operacional":

- **% CPFs acionados no mês** — CPFs da carteira com pelo menos 1 mensagem em `whatsapp_envios_log` no mês ÷ total de CPFs da carteira.
- **% CPFs convertidos** — CPFs da carteira com acordo ativo/concluído ÷ total de CPFs da carteira.
- **CPFs intocados há +30 dias** — contador clicável que abre dialog listando os 100 primeiros (CPF + faixa + risco) para o credor cobrar ação.

---

## Como será implementado (técnico)

Tudo no servidor para evitar baixar dados pesados ao navegador (mesma estratégia já adotada para a carteira).

### 1) Nova migration

Estender a função `comite_carteira_nm_agregar()` (ou criar `comite_carteira_nm_kpis_extras()` separada para manter responsabilidades claras) retornando:

```jsonb
{
  recuperacao: {
    pago_mes_total, pct_sobre_risco,
    por_faixa: { '1-30': pago, '31-60': pago, ... },
    serie_6meses: [{mes, valor}, ...]
  },
  acordos_saude: {
    ativos_qtd, quebrados_qtd, quitados_qtd,
    fechados_mes, quebrados_mes, taxa_quebra,
    em_risco_qtd, em_risco_valor
  },
  cobertura: {
    cpfs_acionados_mes, pct_acionados,
    cpfs_convertidos, pct_convertidos,
    cpfs_intocados_30d_qtd
  }
}
```

Cruzamentos por `cpf_normalize` entre `comite_carteira_nm_item.cpf_cnpj` e `acordos.cliente_cpf` / `whatsapp_envios_log.telefone→cpf` (via `devedores`).

Nova função auxiliar (admin-only) `comite_carteira_nm_intocados(limit int)` para listar os CPFs intocados quando o usuário clicar no card.

`SECURITY DEFINER`, `STABLE`, `GRANT EXECUTE` para `authenticated`, gatekeeper `is_admin_user(auth.uid())`.

### 2) Hook

Em `src/hooks/useComiteNovoMundo.ts`:
- Novo hook `useKpisExtras(mesAno)` que chama a RPC.
- Mantém `refetchInterval: 60s` e invalida via realtime já existente.

### 3) UI

Em `src/pages/ComiteNovoMundo.tsx`:
- 3 novos `Card`s usando design tokens já existentes.
- Coluna nova "% Recuperado" na tabela de faixas (`BreakdownFaixasDialog.tsx` ganha a mesma coluna).
- Mini-gráfico de 6 meses com `recharts` (já está no projeto).
- Dialog `IntocadosListDialog.tsx` (novo) para listar CPFs intocados ao clicar.

### 4) Memória do projeto

Adicionar `mem://features/comite-novomundo/kpis-enriquecidos` documentando os 3 blocos e a função SQL.

---

## Aviso de custo

Tudo roda como **1 RPC agregada extra a cada 60s** (mesma cadência da atual) — impacto irrelevante no Lovable Cloud. Sem novas tabelas, sem novos cron jobs, sem armazenamento extra.

## Arquivos

```text
supabase/migrations/<new>.sql                       (nova função agregadora extra + intocados)
src/hooks/useComiteNovoMundo.ts                     (novo useKpisExtras)
src/pages/ComiteNovoMundo.tsx                       (3 cards novos + coluna)
src/components/comite/BreakdownFaixasDialog.tsx     (coluna % recuperado)
src/components/comite/IntocadosListDialog.tsx       (novo)
mem://features/comite-novomundo/kpis-enriquecidos   (nova memória)
```

## O que NÃO entra

- Nenhuma alteração nas tabelas existentes (`comite_carteira_nm_snapshot`/`_item`, `acordos`, `pagamentos`).
- Nenhuma planilha nova exigida do credor.
- Regras de faixa, NN×Colchão, metas e funil seguem iguais.
