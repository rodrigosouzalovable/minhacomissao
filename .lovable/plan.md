

# Fix: Valores NaN na resposta do chatbot

## Diagnóstico

Consultei diretamente o banco de dados e confirmei o problema. Quando o chatbot responde ao "Sim" do cliente na etapa `proposta_enviada`, ele tenta usar `dados.valor_avista` e `dados.valor_parcelado`, mas esses campos estão **vazios/undefined** na conversa salva.

A pre-hidratação do `useAutoSend.tsx` está salvando os dados no **telefone correto da planilha**, mas existem cenários onde esses valores não chegam — por exemplo, se a conversa já existia de uma interação anterior e os campos não foram populados, ou se o webhook `fromMe` sobrescreve os dados.

## Solução: Fallback robusto no chatbot

Em vez de depender exclusivamente da pre-hidratação, adicionar **cálculo automático direto no chatbot** sempre que os valores estiverem faltando:

### Arquivo: `supabase/functions/whatsapp-chatbot/index.ts`

**No case `proposta_enviada` (linha ~558):**
Antes de montar a resposta, verificar se `dados.valor_avista` é um número válido. Se não for:
1. Usar `dados.valor_total` para calcular (50% à vista, 30% parcelado)
2. Se nem `valor_total` existir, buscar pelo CPF na tabela `devedores`
3. Salvar os valores calculados de volta nos `dados` para próximas etapas

**No case `oferta_valores` (linha ~585):**
Mesma verificação de fallback antes de usar os valores.

```typescript
// Exemplo do fallback:
let valorAvista = Number(dados.valor_avista);
let valorParcelado = Number(dados.valor_parcelado);
let maxParcelas = Number(dados.max_parcelas);

if (!valorAvista || isNaN(valorAvista)) {
  let valorTotal = Number(dados.valor_total);
  if (!valorTotal || isNaN(valorTotal)) {
    // Buscar no banco pelo CPF
    const cpf = dados.cpf;
    if (cpf) {
      const { data: devs } = await supabase.from('devedores')...
      valorTotal = soma dos valor_atualizado;
    }
  }
  valorAvista = valorTotal * 0.5;
  valorParcelado = valorTotal * 0.7;
  maxParcelas = Math.min(24, Math.floor(valorParcelado / 100));
  if (maxParcelas < 2) maxParcelas = 2;
  // Salvar de volta nos dados
  dados = { ...dados, valor_total: valorTotal, valor_avista: valorAvista, 
            valor_parcelado: valorParcelado, max_parcelas: maxParcelas };
}
```

### Arquivo: `src/hooks/useAutoSend.tsx`
Manter a pre-hidratação como está (funciona como otimização), mas alterar o `min_parcelas` para R$ 100 conforme solicitado (atualmente R$ 90).

## Resultado
Mesmo se a pre-hidratação falhar por qualquer motivo, o chatbot **sempre** conseguirá calcular os valores corretos a partir do saldo, garantindo que nunca mais apareça "R$ NaN".

