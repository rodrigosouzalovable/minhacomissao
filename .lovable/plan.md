# UAZAPI: corrigir QR Code + recolher painel de números virtuais

## 1. QR Code não aparece

O que os logs mostram: a UAZAPI responde HTTP 200 ao pedido de conexão, mas com `qrcode` vazio e `status: "disconnected"` — ela ainda não gerou a sessão. Hoje a função só faz poll em `/instance/status`, e nesse endpoint o QR frequentemente continua vazio porque quem realmente dispara a geração é o `/instance/connect`. Resultado: o poll expira e o usuário recebe "Não foi possível obter o QR Code".

Correção:
- No poll, alternar as chamadas: reemitir `POST /instance/connect` (além de consultar `/instance/status`) a cada ciclo, aceitando o QR/paircode de qualquer uma das respostas.
- Aumentar o número de ciclos e usar intervalo curto no começo (1,5s) e crescente depois, mantendo o total dentro do tempo limite da função.
- Ignorar strings vazias em `qrcode`/`paircode` (hoje um `""` já é tratado como ausente, isso permanece).
- Manter a mensagem de erro final, mas incluir o status observado (ex.: "a UAZAPI não gerou o QR — status disconnected") para facilitar diagnóstico.

Na tela, quando o QR ainda não vier na primeira resposta, mostrar o estado "Gerando QR Code..." e tentar novamente automaticamente uma vez antes de exibir erro, em vez de falhar direto.

## 2. Painel de números virtuais recolhível

- Envolver o painel "Números virtuais" em um bloco recolhível (Collapsible) com cabeçalho clicável e seta indicando o estado.
- Estado inicial: **minimizado**.
- A preferência de aberto/fechado fica salva no navegador (localStorage), então se você abrir e sair, ele lembra; sem preferência salva, começa fechado.

## Detalhes técnicos

- `supabase/functions/whatsapp-qr/index.ts`: reescrever `pollForQr` para alternar `connect`/`status`, com backoff, e enriquecer o erro final.
- `src/pages/Acionamento.tsx`: retry automático no `handleConnectQr`/`handleRefreshQr` quando a resposta vier sem QR; envolver `NumerosVirtuaisPanel` em Collapsible com default fechado e persistência em localStorage.
- Nenhuma mudança de banco de dados.
