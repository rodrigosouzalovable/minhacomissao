# Regras de negociação do portal público

## Como está hoje (verificado no código)

- Descontos por dias de atraso (`src/lib/descontoPortal.ts`): até 200 dias → 10% à vista / 0% parcelado; 201–300 → 20%/10%; 301–500 → 30%/20%; acima de 500 → 50%/30%.
- Parcelamento de 2 a 24x; à vista 1x.
- Valor mínimo de parcela hoje é **R$ 90,00** (constante em `ConsultaResultado.tsx` e em `DiscountTierSelector.tsx`).
- Entrada é **opcional**, sem valor mínimo — só valida que não seja maior que o total com desconto.
- Data do primeiro pagamento: obrigatória **apenas na opção parcelada**; o calendário só bloqueia datas passadas (sem limite máximo).
- Na opção **à vista** não existe seleção de data: o botão monta a mensagem direto e ela não contém data alguma.

## O que será alterado

1. **Parcela mínima R$ 100,00** — substituir o mínimo de 90 por 100 no cálculo do número máximo de parcelas, na validação da proposta e no bloqueio dos cartões de desconto.
2. **Entrada mínima R$ 100,00** — quando o cliente informar entrada, ela deve ser 0 (sem entrada) ou no mínimo R$ 100,00. Valor entre R$ 0,01 e R$ 99,99 exibe mensagem de erro e bloqueia o envio.
3. **Data obrigatória também na opção à vista** — adicionar o mesmo seletor de data no fluxo à vista; o botão de WhatsApp só habilita após escolher a data.
4. **Limite de 10 dias para a primeira parcela/entrada** — o calendário passa a permitir apenas de hoje até hoje + 10 dias (datas anteriores e posteriores desabilitadas), tanto à vista quanto parcelado. Texto de apoio: "Até DD/MM/AAAA".
5. **Data na mensagem do WhatsApp** — a mensagem da opção à vista passa a incluir "Quero pagar à vista no dia DD/MM/AAAA"; a mensagem parcelada já traz a data e será mantida, com "Quero pagar a entrada no dia ..." quando houver entrada.

## Detalhes técnicos

- Arquivos afetados: `src/pages/ConsultaResultado.tsx` (constante `VALOR_MINIMO_PARCELA`, `getMaxParcelas`, `isNegociacaoValida`, `gerarWhatsappLink`, calendário e bloco à vista) e `src/components/negociacao/DiscountTierSelector.tsx` (constante `VALOR_MINIMO_PARCELA`).
- Novas constantes compartilhadas: `VALOR_MINIMO_PARCELA = 100`, `VALOR_MINIMO_ENTRADA = 100`, `DIAS_MAX_PRIMEIRO_PAGAMENTO = 10`.
- Nenhuma mudança de banco de dados; regras de desconto permanecem como estão.
