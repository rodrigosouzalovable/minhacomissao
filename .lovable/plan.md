## Objetivo

Na página `/admin/comite-novomundo`, transformar cada campo zerado/vazio em um **ponto de ação guiado** que explica exatamente o que falta no sistema para preencher aquele número — e garantir que, conforme acordos e pagamentos forem registrados no dia a dia, o painel se atualize sozinho sem precisar de importação manual.

---

## Parte 1 — Diagnóstico "Por que está zerado?"

Cada card/linha do relatório ganha um indicador quando o valor é 0/—. Ao passar o mouse (ou clicar em um ícone de alerta âmbar), abre um popover explicando **a causa real** e **o que fazer**. As causas possíveis, mapeadas a partir das queries já existentes em `useComiteNovoMundo.ts`:

| Campo zerado | Causa provável | Ação sugerida (CTA) |
|---|---|---|
| Carteira (CPFs) / Valor em aberto / Aging | Nenhum devedor com `credor = 'ume_novo_mundo'` ativo | Botão "Importar base Novo Mundo" → leva para `/admin/importar-devedores` |
| Funil — Tentativas/Alô/CPC/CPC-A | Sem linhas em `relatorio_acionamentos` no mês | Botão "Importar planilha de ligações" → abre `ImportarLigacoesDialog` |
| Recuperado / Acordos fechados | Sem acordos no mês cujo CPF cruza com a base do credor | "Os acordos do mês ainda não bateram com CPFs da base. Verifique se a base do credor está importada." |
| Meta NN/Colchão/Global = 0 | Sem registro em `comite_metas_novomundo` para o mês | Botão "Definir meta" → abre o `MetasDialog` já existente, scrollado na faixa correta |
| TMR — | Nenhum acordo do mês teve primeiro pagamento ainda | "TMR só calcula quando há pelo menos um pagamento registrado em acordo criado no mês." |
| Tempo em casa "— informar admissão" | `profiles.data_admissao` nulo para o cobrador | Botão (admin) "Informar data de admissão" → mini-dialog que faz update direto no profile |
| Blocos qualitativos vazios | Sem registro em `comite_textos_novomundo` | Botão "Preencher" (já existe — apenas destacar visualmente quando vazio) |

Componente novo: `CampoZeradoHint` (badge âmbar + popover) usado em todos os KPIs, células de tabela e cards.

---

## Parte 2 — Atualização automática contínua

Hoje os dados **já são recalculados a cada visita** porque os hooks usam React Query lendo direto das tabelas (`devedores`, `acordos`, `pagamentos`, `relatorio_acionamentos`). O que falta é:

1. **Realtime**: assinar mudanças nas 4 tabelas via Supabase Realtime e invalidar as queries do React Query — assim, com o painel aberto, qualquer acordo fechado ou pagamento marcado aparece em segundos sem refresh.
2. **Auto-refetch quando a aba ganha foco** (`refetchOnWindowFocus: true`) + polling leve a cada 60s como fallback.
3. **Mês corrente sempre atualizado**: garantir que o seletor de mês, quando aponta para o mês atual, considere o dia corrente para o filtro de `criado_em`/`data_paga`.
4. **Mini-dialog de admissão** salva em `profiles.data_admissao` → o card de Performance recalcula "Tempo em casa" automaticamente.

Nada disso muda schema — usa o que já existe.

---

## Parte 3 — Arquivos a alterar (apenas frontend)

```text
src/components/comite/CampoZeradoHint.tsx        (novo)
src/components/comite/InformarAdmissaoDialog.tsx (novo)
src/hooks/useComiteNovoMundo.ts                  (adicionar realtime + refetchOnFocus)
src/pages/ComiteNovoMundo.tsx                    (envolver KPIs/linhas com CampoZeradoHint;
                                                  abrir MetasDialog em faixa específica via prop;
                                                  destacar blocos qualitativos vazios)
```

Sem migrations. Sem mudanças em edge functions.

---

## Detalhes técnicos

- `CampoZeradoHint` recebe `{ motivo, acao? }` onde `acao` é `{ label, onClick }` ou um link interno.
- Realtime: um único `supabase.channel('comite-nm')` com `postgres_changes` em `acordos`, `pagamentos`, `devedores` (filtrado por `credor=eq.ume_novo_mundo` quando suportado) e `relatorio_acionamentos`. No callback: `queryClient.invalidateQueries({ queryKey: ['comite-nm'] })`.
- React Query: `staleTime: 30_000`, `refetchOnWindowFocus: true`, `refetchInterval: 60_000`.
- `MetasDialog` ganha prop opcional `faixaInicial` para abrir já posicionado.
- `InformarAdmissaoDialog`: input date → `update profiles set data_admissao = ... where id = uid` (RLS já permite admin).

---

## O que NÃO entra neste plano

- Nenhuma alteração de schema, RLS ou edge function.
- Nenhuma mudança em outras páginas além das listadas.
- Não muda regras de cálculo do funil, TMR, agrupamento de faixas — só explica quando está zerado e mantém vivo.
