## Objetivo

Permitir importar a planilha **CPF NOVO MUNDO.xlsx** direto no card "CARTEIRA (CPFs)" da página `/admin/comite-novomundo`. Cada importação **substitui** a anterior e o painel passa a mostrar o breakdown da carteira em 11 faixas de atraso, cruzando com o tipo de credor (INADIMPLENTES x APORTE).

---

## Layout esperado da planilha

Colunas fixas (header obrigatório, primeira linha):

| Coluna | Header | Conteúdo |
|---|---|---|
| A | `CPF/CNPJ` | CPF ou CNPJ (com ou sem máscara) |
| B | `CREDOR` | `UME \| NOVO MUNDO - INADIMPLENTES` **ou** `UME \| NOVO MUNDO - APORTE` |
| C | `ATRASO` | Dias de atraso (número inteiro) |
| D | `RISCO` | Valor em risco (R$) |

Cada linha = 1 contrato. O mesmo CPF pode aparecer em várias linhas.

---

## Faixas de atraso (11 faixas)

```text
1-30, 31-60, 61-90, 91-180, 181-360,
361-720, 721-1080, 1081-1440, 1441-1800, 1801-2000, 2000+
```

Cada linha da planilha é jogada na faixa correspondente ao valor da coluna `ATRASO`. Linhas com atraso ≤ 0 ou vazio entram em "Sem atraso" e não contam para nenhuma faixa.

NN x Colchão: como você escolheu **"Os dois"**, o painel mostra duas visões cruzadas:
- **Por tipo CREDOR** (INADIMPLENTES = NN, APORTE = Colchão) — totais agregados.
- **Por faixa × tipo** — matriz 11 faixas × 2 tipos com qtd de contratos, qtd de CPFs únicos e R$ risco.

---

## Schema (migration nova)

Duas tabelas — uma de cabeçalho (1 linha por importação ativa) e uma de itens.

```text
comite_carteira_nm_snapshot
  id uuid pk
  importado_em timestamptz default now()
  importado_por uuid (auth.users)
  arquivo_nome text
  total_linhas int
  total_cpfs_unicos int
  total_risco numeric
  ativo bool default true   -- apenas 1 ativo; importação nova desativa o anterior

comite_carteira_nm_item
  id uuid pk
  snapshot_id uuid fk
  cpf_cnpj text            -- normalizado, só dígitos
  credor_tipo text         -- 'INADIMPLENTES' | 'APORTE'
  atraso_dias int
  risco numeric
  faixa text               -- '1-30' | '31-60' | ... | '2000+'
  index (snapshot_id, faixa)
  index (snapshot_id, credor_tipo)
```

GRANTs para `authenticated` e `service_role`; RLS permitindo SELECT/INSERT/UPDATE/DELETE apenas para admin (via `is_admin_user(auth.uid())`).

---

## UI

**Card CARTEIRA (CPFs)** ganha um botão pequeno "Importar planilha" (ícone Upload) ao lado do `CampoZeradoHint`. Quando há snapshot ativo:
- KPI principal = total de CPFs únicos do snapshot.
- Subtítulo = "X contratos • R$ Y em risco • importado em DD/MM HH:mm".
- Clicar no card abre o `BreakdownFaixasDialog` com a tabela 11×2 (faixa × tipo) + totais por linha/coluna em qtd contratos, CPFs únicos e R$.

**Dialog `ImportarCarteiraNMDialog`:**
1. Drop / select de `.xlsx` ou `.csv`.
2. Parse no client com `xlsx` (já instalado no projeto — `import * as XLSX from 'xlsx'`).
3. Validação: headers exatos, normaliza CPF (só dígitos), valida `CREDOR` contra os 2 valores aceitos (rejeita linhas fora do padrão e mostra contagem), converte `ATRASO` e `RISCO` para número.
4. Preview: tabela com a matriz 11×2 que vai ser gravada + linha de "linhas ignoradas".
5. Confirmar → desativa snapshot anterior (`update ... set ativo=false`) e insere novo snapshot + itens em chunks de 500 via `supabase.from('comite_carteira_nm_item').insert(...)`.
6. Invalida `['comite-nm','carteira']` no React Query.

---

## Hook `useCarteira`

Substitui a leitura atual (que vinha de `devedores`) por:

1. SELECT do snapshot ativo (`ativo=true` LIMIT 1). Se não existe → retorna zerado com `motivo: 'sem_snapshot'`.
2. Agrega `comite_carteira_nm_item` por `faixa` e `credor_tipo` no client (uma única paginação até 1000×N).
3. Retorna `{ porFaixa, porTipo, matriz, totalCpfsUnicos, totalContratos, totalRisco, importadoEm }`.

O `CampoZeradoHint` do card passa a usar `motivo: 'sem_snapshot'` com CTA "Importar planilha".

As faixas antigas usadas pelo painel (NN: 1-30/31-60/61-90 e Colchão: 91-180/181-360/360+) continuam funcionando — basta somar as novas faixas que caem dentro dessas janelas. O Colchão "360+" passa a ser a soma de todas as faixas ≥ 361.

---

## Arquivos a alterar

```text
supabase/migrations/<new>.sql                        (novo — 2 tabelas + RLS + grants)
src/components/comite/ImportarCarteiraNMDialog.tsx   (novo)
src/components/comite/BreakdownFaixasDialog.tsx      (novo)
src/hooks/useComiteNovoMundo.ts                      (reescrever useCarteira p/ ler snapshot)
src/pages/ComiteNovoMundo.tsx                        (botão importar + abrir breakdown no card)
```

Sem mudanças em outras páginas, edge functions ou regras de cálculo do funil/TMR.

---

## O que NÃO entra

- Não mexe na tabela `devedores` (a carteira passa a ser snapshot manual; o painel deixa de depender da importação de devedores para esse card específico).
- Não cria edge function — parse e insert acontecem no client (admin).
- Não guarda histórico mensal; cada importação substitui a anterior (escolha confirmada).
