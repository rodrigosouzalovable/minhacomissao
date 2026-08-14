# Botão de copiar Pix no WhatsApp do cliente

## O que está acontecendo

O botão "Copiar código Pix" que aparece no nosso Inbox é um recurso nosso, feito em tela. Dentro do WhatsApp do cliente, quem decide mostrar esse botão é o próprio aplicativo — e ele não faz isso para mensagens de texto enviadas pela API Oficial da Meta. Não existe hoje, na API Oficial, um botão nativo "copiar código Pix" (o único botão de cópia disponível é o de cupom promocional, limitado a 15 caracteres, o que não cabe num Pix).

Ou seja: não é possível "ligar" esse botão nativo. O que dá para fazer é entregar ao cliente um jeito com 1 toque de copiar o código.

## Solução proposta

Ao enviar um Pix pelo Inbox Meta, o sistema envia a mensagem com um botão clicável "Copiar código Pix" (botão de link da API Oficial). Ao tocar, o cliente abre uma página nossa, leve e sem login, que mostra:

- valor e nome do recebedor (quando presente no código)
- QR Code do Pix para pagar pelo app do banco
- botão grande "Copiar código Pix" com confirmação de cópia
- o código completo visível, para copiar manualmente se preferir

Assim o cliente resolve em um toque, sem risco de copiar o texto do atendente junto.

## Como fica o fluxo

```text
Atendente cola o Pix no Inbox
      |
      v
Sistema separa texto x código Pix
      |
      +--> mensagem 1: texto do atendente (se houver)
      |
      +--> mensagem 2: código Pix + botão "Copiar código Pix"
                              |
                              v
                    página /pix/<id> (QR + copiar)
```

No Inbox interno nada muda: o balão continua com o botão de copiar já existente.

## Detalhes técnicos

- Nova tabela `pix_links` (id curto, código Pix, telefone/contato, instância, criado_em, expira_em) com RLS: leitura pública apenas via função/rota que busca por id, escrita restrita a usuários autenticados do tenant.
- Página pública `/pix/:id` (React, sem auth) que lê o código, gera o QR Code no cliente e oferece o copiar.
- `send-whatsapp-meta-text` (ou o caminho de envio usado pelo Inbox) passa a aceitar um payload opcional de botão e envia `type: interactive` com `interactive.type: cta_url`, texto do corpo = código Pix, botão "Copiar código Pix" apontando para a página.
- Fallback: se a instância recusar o interativo (erro da Meta), o sistema reenvia como texto simples com o código puro, como hoje.
- Limpeza automática: links de Pix expiram em 7 dias e são apagados por rotina de manutenção, para não acumular dados.
