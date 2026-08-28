# Corrigir aviso "Bloqueio da Meta liberado" quando o número segue restrito

## O que aconteceu (verificado agora)

O número da imagem é **SOUZA 62 8269-0775**. No nosso banco, a última leitura da Meta (hoje 08:31 BRT) mostra:

- status do número: CONNECTED, nome APPROVED, WABA ACTIVE/APPROVED
- qualidade: **RED**
- quarentena até **03/09**, aquecimento automático **ligado**
- estado do pool: **ativo** (foi reaberto pelo aviso)

Ou seja: a notificação que você recebeu está **parcialmente errada**. O que realmente saiu foi o bloqueio "Business Account locked" (a Meta voltou a responder normalmente pela API). Mas o número continua com **qualidade baixa (RED)** e, como o painel da Meta mostra, com **envio restrito** — então a frase "o número voltou para o pool de envios" não deveria ter sido dita, e o número não deveria ter voltado ao pool enquanto está RED e em quarentena.

Motivo técnico: a auto-liberação hoje só olha "número CONNECTED e sem ban_info". Ela ignora a qualidade RED, a quarentena e a restrição de mensagens que a Meta expõe em outros campos (`restrictions` da WABA e `health_status` do número), que não estamos consultando.

## O que vou mudar

1. **Auto-liberação mais rigorosa** (`check-meta-instance-health`)
   - Só devolve o número ao pool se: CONNECTED, sem ban_info, **qualidade GREEN**, **sem quarentena ativa** e **sem restrição de envio** informada pela Meta.
   - Se o bloqueio saiu mas a qualidade ainda é YELLOW/RED, o número **continua fora das campanhas** e em aquecimento automático.

2. **Ler a restrição real da Meta**
   - Passar a consultar `restrictions` na WABA e `health_status` no número. Se vier algo como restrição de mensagens iniciadas pela empresa, o número fica marcado como restrito no sistema, mesmo com status CONNECTED.
   - Salvar isso no snapshot de saúde para aparecer no painel.

3. **Texto da notificação honesto**
   - Quando o bloqueio sai mas a qualidade/restrição continua, a mensagem passa a ser: "Bloqueio da Meta liberado — mas o número segue RED/restrito, continua fora das campanhas e em aquecimento. Previsão de volta: <data>".
   - Só quando estiver realmente liberado + GREEN a mensagem diz que voltou ao pool.

4. **Corrigir o estado atual deste número**
   - Reverter 62 8269-0775 (e qualquer outro que tenha sido reaberto na mesma situação) para fora do pool enquanto estiver RED/em quarentena, mantendo o aquecimento automático rodando.

## Detalhes técnicos

- `supabase/functions/check-meta-instance-health/index.ts`: incluir `health_status` nos fields do phone e `restrictions` nos fields da WABA; criar `restritoMeta` derivado desses campos; condicionar o bloco de auto-liberação (`eraBloqueioMeta && graphOk`) a `qual === 'GREEN' && !quarentenaAtiva && !restritoMeta`; ramificar o texto do aviso `meta_bloqueio_liberado` conforme o estado, usando `linhaPrevisao` de `_shared/meta-recuperacao-aviso.ts`.
- Persistir `saude_restricoes` (jsonb) no snapshot; nova coluna via migração.
- Ajuste de dados pontual: `estado_pool = 'restrita'` para instâncias com quarentena ativa ou qualidade RED que estejam com `estado_pool = 'ativo'`.
- Sem novos crons, polling ou custo adicional — apenas mais dois campos na chamada Graph que já é feita.
