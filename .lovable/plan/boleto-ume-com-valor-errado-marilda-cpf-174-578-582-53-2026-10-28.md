# Boleto UME com valor errado (Marilda, CPF 174.578.582-53)

## O que aconteceu (confirmado)
- Às 13:52 foi gerado um boleto de **R$ 60,14** com vencimento 29/10 para a Marilda.
- **Nenhum acordo foi simulado ou efetivado na UME pelo sistema** para esse CPF (não há registro de simulação/efetivação). O CPF não veio no arquivo do dia, então a tela mostrou o botão "Acordo já efetivado no backoffice", que foi usado.
- O botão de boleto pede à UME "o boleto do que está em aberto até a data". Como o acordo de 2x R$ 180,40 não existia na UME, ela devolveu só a parcela antiga vencida (R$ 60,14).
- A mensagem enviada ao cliente misturou as duas coisas: "2x de R$ 180,40" e "Valor deste boleto: R$ 60,14". O acordo também foi lançado em Meus Acordos.

## Correção
1. **Conferir o valor antes de enviar:** depois de gerar o boleto, o sistema compara o valor devolvido pela UME com o valor da 1ª parcela combinada (tolerância de R$ 1,00).
   - Se bater: envia na conversa e lança em Meus Acordos, como hoje.
   - Se não bater: **não envia nada ao cliente e não lança o acordo**. Mostra o aviso: "A UME gerou boleto de R$ 60,14, mas a 1ª parcela combinada é R$ 180,40. O acordo provavelmente não foi efetivado no backoffice — efetive e clique em Atualizar."
2. **Conferir a data:** se o vencimento do boleto for diferente do 1º vencimento escolhido, mostrar o aviso e não enviar.
3. **Botão "já efetivado no backoffice":** texto de confirmação mais claro, lembrando que o boleto só sai certo se o acordo já existir na UME com o mesmo valor e data.
4. **Caso da Marilda:** listar para você o acordo lançado hoje em Meus Acordos (2x R$ 180,40) para decidir se mantém; o boleto de R$ 60,14 já emitido não pode ser cancelado pelo sistema — a funcionária deve efetivar o acordo no backoffice e gerar o boleto novamente, ou avisar a cliente.
5. Verificar os demais boletos de hoje comparando valor do boleto x parcela lançada, e informar se houve outro caso.

## Detalhes técnicos
- `AcordoUmeApiDialog.tsx` → `gerarBoleto()`: validar `boleto.valor` contra `parcelaBase` (|dif| ≤ 1) e `boleto.vencimento` contra `primeiroVenc` antes de `onEnviar` e `lancarAcordo`.
- Teste unitário da regra de conferência (função pura extraída).
- Consulta de auditoria: `ume_boleto_log` de hoje x `acordos`/`pagamentos` pelo CPF.
