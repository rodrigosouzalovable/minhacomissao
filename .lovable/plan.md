

# Notificar admin quando acordo for fechado pela IA

## Resumo
Quando a IA finalizar um acordo com o cliente (etapa `acordo_finalizado`), enviar automaticamente uma mensagem para o admin (62991672674) informando os detalhes da negociação.

## Mudanças em `supabase/functions/whatsapp-chatbot/index.ts`

### 1. Criar função `notificarAcordoFechado`
Função que monta a mensagem dinâmica com base nos dados da negociação:
- Nome do cliente
- Telefone do cliente  
- Tipo (à vista ou parcelado) + valor + número de parcelas
- Data de pagamento

Exemplo: `"Rodrigo, acabei de fechar um acordo com o cliente Daniela, número 62982184132, em 10x de R$ 109,41, para pagamento hoje."`

### 2. Chamar a função em todos os pontos de finalização
Há 5 pontos onde `salvarEResponder('acordo_finalizado', ...)` é chamado:
- Linha 758: pagamento hoje (à vista ou parcelado)
- Linha 773: data informada durante `aguardando_pagamento_hoje`
- Linha 797: "hoje" interpretado pela IA em `aguardando_data`
- Linha 803: "amanhã" interpretado pela IA em `aguardando_data`
- Linha 828: data válida em `aguardando_data`

Em cada um, após o `salvarEResponder`, chamar `notificarAcordoFechado` passando `dados` e `telefone`.

### Lógica da mensagem
```
const parcelas = dados.parcelas || dados.max_parcelas;
const valorFinal = dados.valor_final || dados.valor_avista;
const tipo = dados.tipo_pagamento;

Se tipo === 'avista':
  "à vista por R$ X"
Se tipo === 'parcelado':
  "em Nx de R$ X"
```

## Arquivo alterado
- `supabase/functions/whatsapp-chatbot/index.ts`

