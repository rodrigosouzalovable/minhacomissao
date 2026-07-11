## Diagnóstico

O portal está mostrando 16 parcelas de R$ 155,48 (total R$ 2.487,68) porque a mesma cliente tem **duas cópias das 8 parcelas** em `devedores`:

- 8 linhas do arquivo `UME 1.xlsx` (importado em 16/04/2026), todas com `ativo=true`
- 8 linhas idênticas do arquivo `BATIMENTO CPF UME 11.07.2026.xlsx` (importado em 11/07/2026), também com `ativo=true`

Mesmo contrato (76866230), mesmas parcelas (3–10), mesmos vencimentos, mesmo valor. O portal soma tudo que está `ativo=true` → 16 parcelas, R$ 2.487,68.

Rodando a checagem em toda a base:

- **14.087 grupos duplicados** (mesmo CPF + contrato + descrição/parcela + vencimento)
- **28.174 linhas envolvidas** → **14.087 linhas precisam ser removidas** (manter uma por grupo)

Causa raiz: a importação por planilha em `Importar Devedores` sempre insere; não confere se aquela parcela específica (CPF + contrato + nº parcela + vencimento) já existe ativa. Quem re-importa o mesmo cliente duplica a dívida no portal.

## Correção — 2 partes

### Parte 1 — Limpeza da base atual (uma migração)

Para cada grupo `(cpf, contrato, descricao, data_vencimento)` com mais de uma linha `ativo=true`, manter apenas a linha **mais antiga** (o `criado_em` menor, que é o registro original correto) e marcar o restante como `ativo=false` — não deletar, para respeitar a política de nunca destruir dados de dívida.

Regra de desempate (menor `criado_em`) escolhida porque:

- O registro original veio da carteira UME de abril, o batimento de julho foi só uma re-importação com o mesmo conteúdo.
- Manter o registro antigo preserva o histórico, `importacao_id` e vínculos (ex.: `acordos_devedor`, telefones etc. que possam ter sido criados apontando para a linha original).

Depois da migração, o CPF `33476276104` volta a ter 8 parcelas ativas de R$ 155,48 = R$ 1.243,84 no portal, batendo com o CobMais.

### Parte 2 — Prevenção (código do fluxo de importação)

Ajustar a importação de planilha de devedores para **não inserir parcela que já exista ativa** com a mesma chave `(cpf, contrato, descricao, data_vencimento)`. Comportamento:

- Antes de inserir um lote, buscar em `devedores` (ativo=true) as chaves já presentes para os CPFs daquele lote.
- Pular as linhas cuja chave já existe (não inserir de novo, não atualizar valor — o valor original permanece o da primeira importação).
- Contabilizar as puladas no resumo pós-import como "já existentes, ignoradas".

Isso mantém o comportamento atual para novos CPFs / novos contratos / novas parcelas, mas impede reimportar o mesmo cliente e dobrar a dívida.

**Escopo:** apenas o fluxo de importação em `src/pages/ImportarDevedores.tsx` (e, se aplicável, a edge function `process-import-job`). Não mexer no portal, no batimento nem em outras telas — o problema não é de leitura, é de dado duplicado + insert cego.

## Verificação após aplicar

1. Reconsultar `33476276104` no portal → 8 parcelas, R$ 1.243,84.
2. Rodar `SELECT COUNT(*)` do grupo duplicado → 0.
3. Re-importar a mesma planilha `BATIMENTO CPF UME 11.07.2026.xlsx` propositalmente → resumo mostra 33.839 linhas ignoradas por já existirem, 0 inseridas, e nenhum CPF passa a ter parcelas duplicadas.

## Detalhes técnicos

SQL da limpeza (parte 1):

```sql
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY cpf, contrato, descricao, data_vencimento
           ORDER BY criado_em ASC, id ASC
         ) AS rn
  FROM public.devedores
  WHERE ativo = true
)
UPDATE public.devedores d
   SET ativo = false,
       atualizado_em = now()
  FROM ranked r
 WHERE d.id = r.id
   AND r.rn > 1;
```

Índice de apoio para a checagem de existência na importação (opcional, mas ajuda no volume atual):

```sql
CREATE INDEX IF NOT EXISTS idx_devedores_dedupe_ativo
  ON public.devedores (cpf, contrato, descricao, data_vencimento)
  WHERE ativo = true;
```

Lógica do dedupe no importador (pseudocódigo):

```ts
// para cada chunk de linhas parseadas:
const chaves = chunk.map(r => ({ cpf: r.cpf, contrato: r.contrato, descricao: r.descricao, data_vencimento: r.data_vencimento }));
const { data: existentes } = await supabase
  .from('devedores')
  .select('cpf, contrato, descricao, data_vencimento')
  .eq('ativo', true)
  .in('cpf', chaves.map(k => k.cpf));
const setExistente = new Set(existentes.map(e => `${e.cpf}|${e.contrato}|${e.descricao}|${e.data_vencimento}`));
const paraInserir = chunk.filter(r => !setExistente.has(`${r.cpf}|${r.contrato}|${r.descricao}|${r.data_vencimento}`));
```

Sem alterações em schema (apenas o índice opcional), RLS, edge functions do portal, ou fluxo do batimento.
