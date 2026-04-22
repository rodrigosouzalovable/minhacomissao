

## Diagnóstico — "Não foi possível obter o QR Code" no fluxo de Código

Dois problemas combinados:

**1. Timeout da UAZAPI (504)** — Ao pedir pareamento por código, a UAZAPI demora mais que 25s para responder porque precisa abrir sessão WhatsApp + gerar pairing code. As 3 tentativas atuais (25s cada) podem não ser suficientes em horários de pico.

**2. Bug no frontend (Acionamento.tsx)** — Mesmo quando o backend devolve o `pairingCode` com sucesso (sem QR), o frontend só verifica `data.qr` nas linhas 1519 e 1545. Se vier só código (caminho normal do pareamento por número), cai no `else` e mostra "Não foi possível obter o QR Code" — falso erro.

## Plano de correção (custo zero, sem IA)

### 1. `supabase/functions/whatsapp-qr/index.ts` — fortalecer fluxo de código
- Aumentar timeout da tentativa de **25s → 45s** quando `phone` está presente (pairing demora mais)
- Aumentar retries de **3 → 5** com backoff progressivo (1.5s, 3s, 4.5s, 6s)
- Adicionar tentativa fallback: se `/instance/connect` falhar com 504 mesmo após retries, fazer GET em `/instance/status` para ver se a sessão já subiu e tentar `/instance/connect` mais uma vez sem `phone` (gera QR como fallback)
- Logs mais claros indicando se foi timeout ou erro de payload

### 2. `src/pages/Acionamento.tsx` — corrigir tratamento da resposta
Em **2 locais** (linhas 1519 e 1545), trocar:
```ts
} else if (qrData?.ok && qrData.qr) {
```
por:
```ts
} else if (qrData?.ok && (qrData.qr || qrData.pairingCode)) {
```
Assim, quando vier só `pairingCode`, o modal mostra o código corretamente (já existe `setPairingCode(...)` logo abaixo).

### 3. UX — feedback durante espera longa
Atualizar texto do botão "Gerar Código" enquanto carrega: mostrar "Aguardando WhatsApp… (pode levar até 1 min)" para o usuário não cancelar prematuramente.

## Resultado esperado

| Cenário | Antes | Depois |
|---|---|---|
| UAZAPI lenta (>25s) | Erro 504 | Retry até 5x com 45s cada |
| Backend retorna só pairingCode | "Não foi possível obter o QR" (falso) | Mostra código corretamente |
| Tela durante espera | "Gerar Código" estático | Mensagem de progresso |

**Custo Lovable Cloud:** zero adicional. São apenas mais retries HTTP para a UAZAPI (não passa por IA, gateway ou storage). Pelo contrário, evita que o usuário clique repetidamente, o que hoje multiplica invocações.

## Fora de escopo
- Não mexo em nada de IA, chatbot, lembretes ou aquecimento
- Não toco em outras instâncias já conectadas
- Não altero a função `whatsapp-chatbot` (já otimizada na sessão anterior)

