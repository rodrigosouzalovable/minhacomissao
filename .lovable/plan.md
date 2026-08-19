# Números virtuais (VirtualSMS) integrados à aba UAZAPI

Viável. É uma integração de API externa autenticada, feita no backend, com a chave guardada como secret. Escopo: **uso interno (admin)**, provedor **VirtualSMS**, com o número comprado entrando direto no fluxo de conexão da UAZAPI.

## O que você vai ver na tela

Nova aba/painel "Números Virtuais" dentro de UAZAPI (visível só para admin):

- **Saldo VirtualSMS** no topo, com botão de atualizar.
- **Comprar número**: selecionar país e serviço (WhatsApp, Telegram, Google...), ver o preço estimado e confirmar.
- **Card do pedido ativo**: número recebido, cronômetro de validade, status ("aguardando SMS", "código recebido", "expirado/reembolsado") e o código destacado com botão de copiar.
- **Cancelar pedido** enquanto o SMS não chegou (dispara o reembolso do provedor).
- **Histórico** dos últimos pedidos: número, serviço, custo, código, status e data.

## Fluxo integrado com a UAZAPI

1. Comprar o número virtual.
2. Botão "Conectar na UAZAPI": cria/seleciona a instância, grava o número no campo `telefone` e pede o **código de pareamento** (fluxo que já existe na aba).
3. O WhatsApp envia o SMS para o número virtual; o painel busca o código e mostra na hora, com botão para copiar.
4. Ao conectar, a instância aparece normalmente na lista da UAZAPI, já com o telefone preenchido.

Observação importante: o WhatsApp valida por SMS/ligação no número. Números com SIM real (VirtualSMS) funcionam na maioria dos casos, mas **nenhum provedor garante 100%** — quando o código não chega, o reembolso automático do provedor cobre o custo.

## Custo e controle de gasto

- Cada compra é debitada do seu saldo na VirtualSMS (fora da Lovable), a partir de ~US$ 0,05 por código.
- O painel mostra o total gasto no mês e permite definir um **limite mensal de compras**; ao atingir, novas compras são bloqueadas.
- **Aviso de custo Lovable Cloud**: para acompanhar a chegada do SMS o painel faz consultas repetidas. Para evitar custo alto, o polling é **só na tela aberta**, a cada 5s, com parada automática em 20 minutos ou quando a aba perde o foco. Sem cron e sem job em background.

## Detalhes técnicos

- Secret `VIRTUALSMS_API_KEY` (Bearer). Nunca no frontend.
- Nova edge function `virtualsms` (admin-only via `has_role`), com ações: `saldo`, `servicos`, `comprar`, `status`, `cancelar`. Ela é a única a falar com `https://virtualsms.io/api/v1/*` (`/balance`, `/orders`, `/orders/{id}/sms`).
- Nova tabela `virtualsms_pedidos` (order_id, servico, pais, numero, codigo, status, custo, criado_por, timestamps) + GRANTs e RLS admin-only; e `virtualsms_config` para o limite mensal.
- `src/pages/Acionamento.tsx`: nova seção/aba "Números Virtuais" com React Query (mutations comprar/cancelar, query de status com `refetchInterval` condicional e visibility guard), reaproveitando o fluxo de código de pareamento já existente e o helper de gravação de `telefone`.
- Erros do provedor (saldo insuficiente, sem número disponível para o serviço/país, chave inválida) traduzidos para mensagens claras em português.
- MCP da VirtualSMS não é usado — a integração é via REST, que é o caminho estável aqui.
