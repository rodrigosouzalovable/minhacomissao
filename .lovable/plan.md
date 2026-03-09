

# Plano: Humanizar Resposta a Saudações na Etapa `proposta_enviada`

## Problema
Na linha 1351-1358 do `whatsapp-chatbot/index.ts`, saudações como "Bom dia" são tratadas como sinal positivo (`isSim = true`) e disparam imediatamente a proposta com valores. O correto é responder de forma conversacional primeiro.

## Alteração

**Arquivo**: `supabase/functions/whatsapp-chatbot/index.ts` (linhas ~1350-1398)

Separar o tratamento de saudações do tratamento de interesse/aceitação:

```typescript
// Antes de entrar no isSim, tratar saudação isolada
if (isSaudacao && !isInteresse) {
  const primeiroNomeCap = dados.nome 
    ? dados.nome.split(' ')[0].charAt(0).toUpperCase() + dados.nome.split(' ')[0].slice(1).toLowerCase()
    : '';
  resposta = primeiroNomeCap
    ? `${textoLower.includes('bom dia') ? 'Bom dia' : textoLower.includes('boa tarde') ? 'Boa tarde' : textoLower.includes('boa noite') ? 'Boa noite' : 'Olá'}, ${primeiroNomeCap}! Tudo bem? Posso te passar a proposta?`
    : `${textoLower.includes('bom dia') ? 'Bom dia' : textoLower.includes('boa tarde') ? 'Boa tarde' : textoLower.includes('boa noite') ? 'Boa noite' : 'Olá'}! Tudo bem? Posso te passar a proposta?`;
  await salvarEResponder('proposta_enviada'); // permanece na mesma etapa
  break;
}
```

- A saudação isolada ("Bom dia", "Oi", "Boa tarde") gera resposta conversacional e **permanece** na etapa `proposta_enviada`
- Quando o cliente responder "sim", "pode", etc., aí sim dispara a proposta com valores
- Expressões de interesse ("como fica", "quero saber") continuam disparando a proposta normalmente
- Remover `isSaudacao` da condição `isSim` para não confundir saudação com aceitação

