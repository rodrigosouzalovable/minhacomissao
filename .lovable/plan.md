# Plano — Página "Comitê Novo Mundo"

Nova rota interna `/admin/comite-novomundo` que reproduz o template do Comitê de Resultados UME já preenchido com dados reais do credor `ume_novo_mundo`, com seletor de mês e exportação.

## O que vem direto do banco (sem trabalho extra)

- **Base / Carteira**: `devedores` onde `credor = 'ume_novo_mundo' AND ativo = true` (qtd, valor original, valor atualizado).
- **Aging List**: mesma tabela, agrupando por dias de atraso a partir de `data_vencimento`:
  - NN: 1–30 / 31–60 / 61–90
  - Colchão: 91–180 / 181–360 / 360+
- **Funil do mês** (por hora e dia, somado no mês): `relatorio_acionamentos` → tentativas, whatsapp, alô, CPC, CPC-A, acordos_valor.
- **Acordos fechados**: `acordos` filtrando CPFs do Novo Mundo (qtd, valor_total, ticket médio).
- **Recuperação realizada**: `pagamentos` com `status='pago'` no mês, juntando com `acordos` do credor.
- **Performance por cobrador**: `acordos` + `pagamentos` agrupado por `user_id`/`profiles.nome` (qtd acordos, valor acordado, valor recebido, taxa).
- **TMR**: média de `(data_paga do 1º pagamento − criado_em do acordo)` em dias, por mês.
- **Mês anterior vs atual**: mesma RPC `comparativo_mensal_global` adaptada para filtrar por credor.

## O que precisa de schema novo (tudo numa migração)

1. **`profiles.data_admissao DATE`** — para calcular "Tempo em casa" do operador.
2. **`comite_metas_novomundo`** — meta mensal por faixa:
   - `mes_ano TEXT` (YYYY-MM), `faixa TEXT` (`1-30`, `31-60`, `61-90`, `91-180`, `181-360`, `360+`, `total`), `meta_valor NUMERIC`, `tipo TEXT` ('nn' | 'colchao' | 'global').
   - RLS: leitura para `authenticated`, escrita só admin.
3. **`comite_textos_novomundo`** — blocos qualitativos editáveis:
   - `mes_ano TEXT`, `bloco TEXT` (`acoes_mes`, `proximos_passos`, `observacoes`, `dificuldades`, `ata`), `conteudo TEXT`.
   - RLS: leitura `authenticated`, escrita só admin/gestor.

## Frontend

Arquivos novos:
- `src/pages/ComiteNovoMundo.tsx` — página com seletor de mês (default = mês atual) e seções na ordem do template.
- `src/components/comite/` — um componente por bloco:
  - `FunilCard.tsx` (base → trabalhadas → alô → CPC → acordo → pagamento, com % conversão entre etapas)
  - `RecuperacaoNNColchao.tsx` (tabela faixa × meta × realizado × % atingido)
  - `AgingList.tsx`
  - `PerformanceCobradores.tsx` (qtd acordos, valor, recebido, tempo em casa)
  - `TMRCard.tsx`
  - `BlocoTexto.tsx` (editor inline reutilizável para os 5 blocos qualitativos)
  - `MetasEditorDialog.tsx` (modal para cadastrar/editar metas do mês)
- `src/hooks/useComiteNovoMundo.ts` — hooks React Query, um por seção.

Adicionar rota em `src/App.tsx` (lazy) protegida por `AdminRoute`, e link no menu lateral (`AppLayout`) para admin/gestor.

## Cálculos-chave

- **Trabalhadas**: count distinct de CPFs com tentativa no mês (via `relatorio_acionamentos_log` + futura tabela de tentativas individualizada — por ora aproximamos por `SUM(tentativas)` da `relatorio_acionamentos`).
- **% conversão**: alô/tentativas, CPC/alô, CPC-A/CPC, pago/CPC-A.
- **TMR**: ver acima.
- **Tempo em casa**: `now() - profiles.data_admissao` em dias, mostrado no ranking.

## Export

Botão "Exportar PDF" usando `window.print()` com CSS print já estilizado (sem dependência nova, custo zero).

## O que falta você me informar (resposta direta à sua pergunta)

Tudo já foi respondido nas perguntas acima:

1. ✅ Faixas NN/Colchão definidas.
2. ✅ Metas cadastradas dentro da própria página (modal).
3. ✅ Blocos qualitativos editáveis na própria tela.
4. ✅ TMR = dias entre acordo e 1º pagamento.
5. ⚠️ **Você vai precisar preencher manualmente, depois que a tela estiver pronta:**
   - **Data de admissão de cada cobrador** (em "Minha Conta" do admin ou edição rápida na tela de Usuários) — sem isso "Tempo em casa" fica vazio.
   - **Metas mensais** do Novo Mundo (NN, Colchão e global) — primeira vez para Maio/2026.
   - **Textos do mês** (Ações, Próximos passos, Observações, Dificuldades, Ata).

Nenhum dado operacional adicional é necessário — todo o resto sai do que já está no sistema.

## Custo Lovable Cloud

Impacto mínimo: leitura agregada de tabelas existentes + 2 tabelas novas pequenas (metas/textos têm <12 linhas por mês). Sem edge functions, sem cron, sem IA.
