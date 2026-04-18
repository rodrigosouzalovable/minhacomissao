

## Plano: Conectar WhatsApp via Código de Pareamento

### Como funciona
A UAZAPI já suporta código de pareamento nativo. Quando você envia o número do WhatsApp para `/instance/connect`, ela retorna um código de 8 dígitos (ex: `ABCD-1234`) em vez do QR. O usuário digita esse código no WhatsApp do celular em **Aparelhos conectados → Conectar com número de telefone**.

A boa notícia: **a infraestrutura já está 90% pronta** — o backend já lê o campo `paircode` e a UI já exibe ele quando presente. Só falta:
1. Permitir o usuário escolher o método (QR ou Código)
2. Enviar o telefone para a UAZAPI quando a opção "Código" for escolhida

### Mudanças

**1. `supabase/functions/whatsapp-qr/index.ts`**
- Aceitar parâmetro opcional `phone` na ação `qr` e `create-instance`
- Quando vier `phone`: enviar `{ phone: "5562999999999" }` no body do POST `/instance/connect` (em vez de `"{}"`)
- Resposta continua igual (já extrai `pairingCode` do retorno)

**2. `src/pages/Acionamento.tsx` (Dialog de configuração WhatsApp)**
- Trocar o botão único "Conectar via QR Code" por um seletor com 2 opções:
  - **QR Code** (atual, padrão)
  - **Código de Pareamento** — abre input para digitar o número (ex: `62982458447`)
- Ao escolher "Código": mostrar tela com input de telefone → botão "Gerar Código" → exibir código grande tipo `ABCD-1234` com instruções:
  > 1. Abra o WhatsApp no celular
  > 2. Toque em **Aparelhos conectados** → **Conectar com número**
  > 3. Digite o código mostrado
- Polling de status (já existe) detecta a conexão automaticamente
- Mesmo fluxo se aplica ao **reconectar** instância existente

### UI (esboço)
```text
┌─ Conectar WhatsApp ─────────────────┐
│  ( ) QR Code   (•) Código           │
│                                     │
│  Número (com DDD):                  │
│  [+55] [62 99999-9999]              │
│  [ Gerar Código ]                   │
│                                     │
│  ─── Após gerar: ───                │
│  Seu código:                        │
│      A B C D - 1 2 3 4              │
│  Aguardando conexão... (60s)        │
└─────────────────────────────────────┘
```

### Custo Lovable Cloud
**Zero impacto.** Mesma chamada de edge function existente, só mudando o body do POST upstream.

### Fora de escopo
- Não removo o fluxo QR — fica como opção alternativa
- Validação avançada de número internacional (apenas DDI 55 / Brasil por enquanto)

