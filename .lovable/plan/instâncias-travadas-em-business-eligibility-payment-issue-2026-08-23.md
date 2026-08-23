# Instâncias travadas em "Business eligibility payment issue"

## O que está acontecendo (verificado)

O erro `#131042 – Business eligibility payment issue` vem da própria Meta: a Business Manager dona daquele número não tem um **método de pagamento válido/aprovado** (cartão recusado, cartão vencido, fatura em aberto, limite estourado, ou BM ainda sem verificação de negócio). Não é qualidade do número, nem culpa do contato, nem do nosso sistema. Enquanto a Meta devolver esse erro, nenhum envio sai por aquele número.

Hoje, no banco, 4 números estão com `estado_pool = 'restrita'` e motivo `Business eligibility payment issue`, e a pausa automática de 24h **já venceu há dias** (a mais antiga em 19/08, as outras em 22/08). Três deles estão na BM `947533703218018` e um sem BM vinculada — ou seja, o problema é da conta de faturamento, não dos números.

O que você deve fazer do lado da Meta:
- No Business Manager da BM afetada: Configurações de pagamento → trocar/adicionar cartão (crédito internacional habilitado, sem 3DS bloqueando), pagar faturas em aberto e definir o cartão como principal.
- Confirmar que a BM está com verificação de negócio concluída — sem isso a Meta também devolve erro de elegibilidade.
- Como as BMs são compartilhadas, corrigir o pagamento de uma BM libera todos os números vinculados a ela de uma vez.

Do nosso lado existe um problema real e é isso que o plano corrige: quem cai por pagamento **nunca volta sozinho para o pool**, mesmo depois de você resolver na Meta. A auto-liberação que já existe só reconhece bloqueio de conta (#131031) e número inacessível (#100) — motivos de pagamento/faturamento ficam de fora e o número segue com o selo vermelho "fora do pool" para sempre, até alguém mexer manualmente.

## O que vou implementar

1. **Auto-liberação por pagamento**: incluir motivos de pagamento/faturamento/elegibilidade na revalidação de saúde. Se a Graph API voltar a responder `CONNECTED`, sem `ban_info` e sem erro, o número volta ao pool (`estado_pool = 'ativo'`, pausa limpa) e você recebe um aviso único no WhatsApp de que foi liberado.
2. **Liberar o que já expirou**: quando a pausa automática já venceu e o motivo era de pagamento, tratar como "pendente de revalidação" em vez de permanentemente restrito — o próximo health check decide.
3. **Selo mais claro no card**: o badge vermelho passa a explicar em português que é pendência de pagamento na BM e que a liberação é automática após regularizar, com o botão "Revalidar na Meta" ao lado (já existe) como forma de forçar a checagem na hora.
4. **Ação em lote por BM**: como a pendência é da BM, incluir no card da BM um botão "Revalidar todos os números desta BM", para liberar todos de uma vez depois que você trocar o cartão.

## Detalhes técnicos

- `supabase/functions/check-meta-instance-health/index.ts`: ampliar `eraBloqueioMeta` para cobrir `payment`, `billing`, `eligibility` e `#131042` (reaproveitando `ehMotivoBloqueioMeta` de `_shared/meta-conta-bloqueada.ts`), mantendo a condição de liberação atual (`CONNECTED` + sem `ban_info` + sem erro + sem nova pausa nesta rodada).
- `supabase/functions/_shared/meta-conta-bloqueada.ts`: expor um helper `ehMotivoPagamento` para uso compartilhado entre função e UI.
- `src/lib/humanizarErroEnvio.ts`: refinar o texto do `#131042` para citar troca de cartão, fatura em aberto e verificação da BM, e informar que a liberação é automática após a revalidação.
- `src/pages/ConfigurarMeta.tsx`: texto do badge "fora do pool" quando o motivo for pagamento e botão de revalidação em lote por BM (invoca `check-meta-instance-health` por instância da BM).
- Nenhuma alteração de schema; nenhum cron novo (a revalidação usa o health check já existente).
