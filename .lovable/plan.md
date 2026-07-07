## Objetivo

Adicionar um botão "Reativar envio" na página `Envio Meta` para retomar um job que foi cancelado (ou terminou com erro), continuando de onde parou — sem reenviar os contatos já processados.

## Como vai funcionar

- Quando um envio termina (cancelado / erro / concluído) e ainda existem contatos pendentes (`enviados + erros < total`), aparece um novo botão **"Reativar envio (N restantes)"** ao lado do "Limpar resultados".
- Ao clicar, o job volta a `status = 'rodando'` e o worker (`envio-meta-massa-tick`) continua processando apenas os itens que ainda estão como `pendente` — os já `enviado` / `erro` não são refeitos.
- Se todos os 765 já tiverem sido processados (nada em `pendente`), o botão não aparece.

## Mudanças técnicas

1. **`supabase/functions/envio-meta-massa-control/index.ts`** — nova ação `reativar`:
   - Aceita apenas jobs em `cancelado` / `erro` / `concluido`.
   - Atualiza o job: `status='rodando'`, `concluido_em=null`, `status_motivo=null`, `proximo_em=now()`.
   - Dispara `envio-meta-massa-tick` imediatamente (mesmo padrão da ação `retomar`).

2. **`src/contexts/EnvioMetaSendingContext.tsx`**:
   - Nova função `reativar()` no contexto (invoca `envio-meta-massa-control` com `acao: 'reativar'`).
   - Expõe `restantes` calculado (`job.total - job.enviados - job.erros`) para a UI decidir se mostra o botão.

3. **`src/pages/EnvioMeta.tsx`**:
   - Ao lado do "Limpar resultados", renderiza `<Button onClick={reativar}>Reativar envio ({restantes})</Button>` quando `resultado` existe e `restantes > 0`.

Nenhuma mudança de schema, RLS ou regras de negócio de envio — apenas retomada do mesmo job.