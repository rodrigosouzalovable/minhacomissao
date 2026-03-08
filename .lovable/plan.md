

# Melhorar compreensão da IA em respostas básicas na negociação

## Problema
Na etapa `proposta_enviada`, quando o cliente responde com saudações como "Olá tudo bem?" ou expressões de interesse como "Como fica?", a IA não reconhece como interesse positivo. O fluxo atual:

1. Cliente recebe: "Você consegue voltar a pagar com 50% de desconto?"
2. Cliente responde: "Olá tudo bem?" → Não bate no regex de parcelas, não bate na lista `isSim`, cai no `else` → **chama `salvarSilenciosoENotificar`** → conversa vai para `aguardando_humano`
3. Mensagem seguinte "Como fica?" é ignorada porque já está em `aguardando_humano`

O problema é que "Olá tudo bem?" é uma saudação que demonstra interesse (o cliente está respondendo à proposta), e "Como fica?" já está na lista `isSim` mas nunca chega a ser processada.

## Solução

### 1. Expandir reconhecimento de respostas positivas em `proposta_enviada` (linha ~835-836)
Adicionar saudações e expressões comuns que indicam interesse:
- Saudações: "ola", "olá", "oi", "bom dia", "boa tarde", "boa noite", "tudo bem"
- Interesse: "me fala", "fala mais", "explica", "qual valor", "quanto", "qual o valor", "me interessa", "tenho interesse"
- Combinações: "ola como fica", "oi quero", etc.

Tratamento: se o texto contém uma saudação (mesmo sem dizer "sim" explicitamente), tratar como interesse positivo e seguir para `oferta_valores`.

### 2. Aplicar a mesma lógica na etapa `oferta_valores` (linhas ~900+)
Garantir que frases genéricas de interesse também funcionem nessa etapa.

### 3. Lógica proposta
```
// Antes do check de isSim, detectar saudações/interesse
const isSaudacao = /^(ol[aá]|oi|bom dia|boa tarde|boa noite|e a[ií]|tudo bem)/i.test(textoLower);
const isInteresse = /(como fica|qual.?valor|quanto|me fala|explica|fala mais|me interessa|tenho interesse|quero saber)/i.test(textoLower);

const isSim = intencao?.includes('sim') ||
  ['sim', 'consigo', ...].includes(textoLower) ||
  isSaudacao || isInteresse;
```

## Arquivo alterado
- `supabase/functions/whatsapp-chatbot/index.ts`

