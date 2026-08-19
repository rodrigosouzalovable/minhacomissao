# Números virtuais: teto de preço + provedor com escolha de DDD

## Por que o preço variou (US$ 0,84 → US$ 1,59)

A VirtualSMS usa **preço dinâmico**: o custo muda por operadora e por disponibilidade de estoque no momento da compra. Não é erro do sistema — o painel simplesmente aceitava qualquer preço que o provedor oferecesse. O protocolo dela (padrão SMS-Activate) aceita um parâmetro de **preço máximo**, que hoje não estamos enviando.

## Resultado da pesquisa de provedores

| Provedor | Escolhe DDD? | Preço | Observação |
|---|---|---|---|
| **SMS24H** (sms24h.org) | **Sim** — método próprio de compra por DDD | Tabela **fixa** em BRL | Brasileiro, único com DDD documentado |
| 5sim.net | Não (só operadora) | Dinâmico | API moderna e estável, bom fallback |
| SMS-Activate e clones (incl. VirtualSMS) | Não | Dinâmico | Aceitam teto de preço (`maxPrice`) |
| SMSPVA / SMSHub / Textverified / Onlinesim | Não | Dinâmico | Sem DDD; Onlinesim tem números públicos reusados (alto risco de ban) |

Conclusão: para DDD e preço fixo, o caminho é o **SMS24H**. A VirtualSMS fica como alternativa, agora com custo travado.

## O que vou fazer

### 1. Teto de preço na VirtualSMS (US$ 0,90)
- A compra passa a enviar o teto de **US$ 0,90** ao provedor. Se não existir número nesse preço, o painel avisa "nenhum número disponível até US$ 0,90 — tente outro país/operadora ou aumente o teto", em vez de comprar caro.
- O teto fica salvo na configuração e editável no painel (campo "Preço máximo US$"), começando em 0,90.
- Antes de confirmar a compra, o painel mostra o **preço estimado atual** consultado no provedor.

### 2. SMS24H como segundo provedor, com DDD
- Seletor de **Provedor** no topo do painel: "VirtualSMS" ou "SMS24H".
- Com SMS24H selecionado: campos **Serviço**, **DDD** (lista com os DDDs brasileiros; opcional = qualquer) e o preço fixo da tabela do provedor exibido antes da compra.
- Saldo, compra, consulta de código, cancelamento e histórico funcionam igual ao fluxo atual — inclusive o botão "Conectar na UAZAPI" e a espera de 5 min para cancelar.
- O histórico passa a mostrar de qual provedor veio cada número e o DDD, para você comparar custo real e taxa de ban por provedor.

### 3. Registro de número banido
- Botão "Marcar como banido" no histórico. Serve para você ver quais provedores/DDDs entregam números já queimados no WhatsApp, que é um risco real de qualquer provedor desse tipo (o reembolso só cobre quando o SMS não chega, não quando o número vem banido).

## Detalhes técnicos

- Nova secret `SMS24H_API_KEY` (você cria a conta em sms24h.org, pega a API Key e eu peço o valor pelo formulário seguro).
- `supabase/functions/virtualsms/index.ts` vira multi-provedor: um adaptador por provedor (ambos são `handler_api`, então o código é quase todo compartilhado), com `provider` no corpo da requisição. VirtualSMS passa a enviar `maxPrice`; SMS24H usa o endpoint de compra por DDD.
- Migração: colunas `provider` (default `virtualsms`), `ddd` e `banido_em` em `virtualsms_pedidos`; `preco_max_usd` em `virtualsms_config`.
- `src/components/acionamento/NumerosVirtuaisPanel.tsx`: seletor de provedor, campo de DDD, campo de teto de preço, preço estimado, coluna de provedor/DDD e ação "marcar como banido".
- Sem cron novo, sem polling extra: mantém o webhook + verificação de segurança de 20s só com a aba aberta.

## Custo

Nenhum aumento de custo no Lovable Cloud (mesmas funções e tabelas). A economia vem do teto de preço e do preço fixo em BRL do SMS24H.
