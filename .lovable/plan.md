## Objetivo
Na aba **Acordos da equipe**, adicionar botão **"Importar pagos"** que lê uma planilha padrão Cob+ (aba `Pagamentos`) e marca automaticamente as parcelas correspondentes como pagas nos acordos do sistema, validando o valor.

## Planilha (aba `Pagamentos`)
Colunas usadas:
- **B — CPF/CNPJ** → identifica o cliente
- **J — VALOR PAGO** → valor a conferir contra `pagamentos.valor_parcela`
- **N — DATA** → data real do pagamento (grava em `pagamentos.data_paga`)
- **Q — PARCELA** → número da parcela (usado como desempate quando existe)
- **D — CONTRATO** → desempate adicional quando o CPF tem mais de um acordo

As outras abas (Cobrança, Telefones, etc.) são ignoradas.

## Fluxo de importação

1. Botão **Importar pagos** em `src/pages/EquipeAcordos.tsx`, ao lado dos demais filtros/ações.
2. Abre diálogo com upload `.xlsx` e um preview em tabela:
   - CPF, Nome, Contrato, Parcela, Valor planilha, Data pagamento
   - Status por linha: `pronto`, `sem_acordo`, `sem_parcela_pendente`, `valor_divergente`, `ja_pago`.
3. Preview roda no navegador (`xlsx` já está no projeto — veja `parseCobmaisPlanilha.ts`), consultando `acordos` + `pagamentos` via Supabase para casar cada linha antes de confirmar.
4. Botão **Confirmar importação** aplica os `UPDATE` em `pagamentos` para as linhas com status `pronto` (e, opcionalmente, `valor_divergente` se o usuário marcar "Marcar mesmo com valor divergente").
5. Ao final, toast com resumo: X pagos aplicados, Y ignorados, Z divergências, W sem acordo. Também baixa CSV do relatório.

## Regra de casamento (linha da planilha → parcela)

Para cada linha:
1. Normaliza CPF (só dígitos, com padding para 11).
2. Busca `acordos` ativos desse CPF (`cliente_cpf = ?`, `status IN ('ativo','quebrado')`). Se não achar → `sem_acordo`.
3. Se `CONTRATO` bater com `acordos.contrato_origem` (quando existir), prioriza esse acordo; senão usa o acordo ativo mais recente.
4. Dentro do acordo, procura em `pagamentos` a parcela pendente:
   - Se `PARCELA` da planilha existe e casa com `numero_parcela` e `status='pendente'` → usa essa.
   - Senão, pega a primeira `status='pendente'` em ordem de `numero_parcela`.
   - Se não houver pendente → `ja_pago` ou `sem_parcela_pendente`.
5. Compara `VALOR PAGO` × `pagamentos.valor_parcela` com tolerância de **R$ 0,01**:
   - Igual → `pronto`.
   - Diferente → `valor_divergente` (mostra os dois valores lado a lado).

## Permissão
O botão fica visível para **admin/manager** (mesmo padrão dos outros botões dessa página). Não usa a nova flag `pode_marcar_pago_global` — é ação administrativa em massa.

## Detalhes técnicos
- Novo componente: `src/components/ImportarPagosDialog.tsx`.
- Parser dedicado: `src/lib/parsePagamentosCobmais.ts` (lê aba `Pagamentos`, retorna linhas normalizadas). Não altera `parseCobmaisPlanilha.ts`.
- Update final feito em lotes de 200 via `supabase.from('pagamentos').update({ status: 'pago', data_paga }).eq('id', ...)`.
- Sem mudança de schema, sem edge function nova, sem cron.
- PDF/arquivo não é armazenado; a planilha fica só em memória do navegador.

## Fora de escopo
- Não cria acordos novos a partir da planilha.
- Não mexe em comissão manualmente — a trigger existente de `pagamentos` cuida disso quando o status vira `pago`.
- Não altera parcelas de acordos `quitado` ou já `pago`.
