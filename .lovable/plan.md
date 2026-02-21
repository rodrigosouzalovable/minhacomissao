

## Adaptar mensagem do WhatsApp para pagamento a vista

### Problema

Quando o cliente seleciona pagamento a vista, a mensagem enviada pelo WhatsApp diz "1x de R$ 419,67. Quero pagar a primeira parcela no dia...". Isso nao faz sentido para pagamento a vista -- deveria dizer algo como "Quero pagar no dia..." sem mencionar parcelas.

### Solucao

**Arquivo:** `src/pages/ConsultaResultado.tsx` (funcao `gerarWhatsappLink`, linhas 139-144)

Adicionar uma condicao para quando `neg.descontoFaixa === 'avista'`, gerando uma mensagem especifica:

```
Ola! Meu nome e [nome], meu CPF e [cpf] e quero negociar os contratos em aberto [contratos], no valor total de R$ [total], com desconto de 50%, totalizando R$ [valor]. Quero pagar a vista no dia [data]. Me envie o boleto por gentileza.
```

Para os demais casos (parcelado com ou sem entrada), a mensagem atual sera mantida.

### Detalhes tecnicos

Na funcao `gerarWhatsappLink`, antes do bloco `if (neg.entrada > 0)`, adicionar:

```typescript
if (neg.descontoFaixa === 'avista') {
  msg = `Ola! Meu nome e ${nomeCliente}, meu CPF e ${cpfCliente} e quero negociar os contratos em aberto ${contratosStr}, no valor total de ${formatCurrency(valorTotal)}${descontoStr}. Quero pagar a vista no dia ${dataFormatada}. Me envie o boleto por gentileza.`;
} else if (neg.entrada > 0) {
  // mensagem atual com entrada + parcelas
} else {
  // mensagem atual com parcelas
}
```

