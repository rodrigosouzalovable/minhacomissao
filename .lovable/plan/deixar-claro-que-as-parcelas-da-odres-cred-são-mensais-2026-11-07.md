# Deixar claro que as parcelas da Odres Cred são mensais

No portal de negociação, na carteira **Odres Cred**, logo abaixo da escolha de parcelas:

- Opções da lista passam a mostrar "2x mensais de R$ 559,90".
- O resumo muda para "2 parcelas **mensais** de R$ 559,90."
- Logo abaixo, um aviso em destaque: "**Pagamento mensal:** as parcelas vencem uma vez por mês, sempre no mesmo dia do primeiro pagamento. Não é quinzenal."

Valores, datas, quantidade de parcelas e as demais carteiras (UME e Novo Mundo) continuam iguais.

## Detalhes técnicos
- Alteração só visual em `src/components/portal/PortalWalletSection.tsx`, aplicada quando `wallet.credor` for Odres.
