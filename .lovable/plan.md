

# Forçar mensagem fixa (sem IA) na proposta após confirmação de CPF

## Problema
A função `gerarRespostaHumana` está ignorando as instruções e gerando respostas longas, com numeração, emojis e tom robótico. Mesmo com o fallback correto, a IA sobrescreve com texto longo.

## Solução
**Remover a chamada à IA** no momento da proposta após confirmação de CPF. Usar diretamente a mensagem fixa (fallback) que já está no formato exato desejado:

> "Perfeito, Jose! A proposta disponível para *pagamento à vista é R$ 714,80*, pagando esse valor, você quita todas as parcelas em aberto com as Lojas Novo Mundo. Ou podemos parcelar para você da seguinte forma: *5x de R$ 200,14*. Como fica melhor para você?"

## Mudança em `supabase/functions/whatsapp-chatbot/index.ts`

**Linhas ~628-649**: Substituir o bloco que chama `gerarRespostaHumana` por uso direto do fallback:

```typescript
// ANTES (linhas 628-649):
const fallbackProposta = `Perfeito, ${primeiroNomeCapitalizado}! ...`;
resposta = await gerarRespostaHumana(..., fallbackProposta);

// DEPOIS:
resposta = `Perfeito, ${primeiroNomeCapitalizado}! A proposta disponível para *pagamento à vista é ${formatCurrency(valorAvista)}*, pagando esse valor, você quita todas as parcelas em aberto com ${credorNome}. Ou podemos parcelar para você da seguinte forma: *${maxParcelas}x de ${formatCurrency(valorParcelaMin)}*. Como fica melhor para você?`;
```

Mesma abordagem será aplicada ao case `novo`/`aguardando_cpf` (linhas ~512-538) quando o CPF é digitado manualmente — a proposta também usará mensagem fixa curta em vez de IA.

## Resultado
A mensagem enviada será **exatamente** o texto curto e humano, sem variação da IA.

