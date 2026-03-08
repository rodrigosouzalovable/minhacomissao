

# Reformular proposta do chatbot: listar todas as opções de parcelamento

## Problema
Quando o cliente responde positivamente ("Consigo sim"), o bot envia apenas o valor máximo de parcelas (ex: "24x de R$ X"). O cliente não vê todas as opções e o fluxo pula direto para "Você escolheu parcelar!".

## Solução
Criar uma função `gerarListaParcelamento()` que gera a lista completa de opções (2x a Nx) onde cada parcela >= R$100. Substituir a resposta da etapa `proposta_enviada` (quando cliente aceita) e da etapa `oferta_valores` para usar essa lista.

### Nova função auxiliar (no topo do arquivo)

```typescript
function gerarListaParcelamento(valorParcelado: number): string {
  const linhas: string[] = [];
  for (let i = 2; i <= 24; i++) {
    const valorParcela = valorParcelado / i;
    if (valorParcela < VALOR_MINIMO_PARCELA) break;
    linhas.push(`${i}x de *${formatCurrency(Math.ceil(valorParcela * 100) / 100)}*`);
  }
  return linhas.join('\n');
}
```

### Alteração na etapa `proposta_enviada` (linhas ~970-1008)

Quando o cliente diz "sim", em vez da mensagem genérica com apenas 1 opção, enviar:

```
Que ótimo! 🎉

Estamos com uma super oportunidade para você quitar todo débito em aberto pelo valor de *R$ 2.500,00* à vista.

Ou podemos parcelar para você da seguinte forma:

2x de *R$ 1.225,00*
3x de *R$ 816,67*
4x de *R$ 612,50*
...
(até parcela >= R$ 100)

Como prefere pagar? Responda com o número de parcelas desejado (ex: *3x*) ou *à vista*.
```

### Alteração na etapa `oferta_valores` (linhas ~1018+)

Quando o bot repete as opções, usar o mesmo formato de lista.

### Também: template `escolha_parcelado`

Se existir template cadastrado para `escolha_parcelado`, ele será substituído pela lógica hardcoded com a lista, pois o template não suporta gerar N linhas dinamicamente. Vou ignorar o template neste caso.

## Arquivo alterado
- `supabase/functions/whatsapp-chatbot/index.ts`

