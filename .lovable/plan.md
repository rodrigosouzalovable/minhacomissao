## Problema

No modo Rajada, quando uma instância cai para qualidade **YELLOW** ou **RED**, o sistema `check-meta-instance-health` está pausando ela automaticamente (`estado_pool='pausado'` + `pausa_automatica_ate`). Isso faz:

1. `envio-meta-massa-burst` detecta `estado_pool='restrita'` OU `pausa_automatica_ate > agora` e encerra o worker sem re-agendar → os 418 itens ficam parados.
2. Os poucos itens que já estavam "processando" ao mudar de estado batem no `send-whatsapp-meta`, que devolve "Instância não está ativa no pool (estado: pausado)" e marca como erro.
3. `envio-meta-massa-iniciar` também filtra RED/YELLOW já no início do rajada.

O usuário quer que, **no modo Rajada**, YELLOW/RED **não** interrompam o envio — só interrompam de fato quando a Meta banir/restringir a instância (status `FLAGGED`, `RESTRICTED`, `BANNED` ou erro `#131031/#368/"restricted"/"banned"` retornado no envio real).

## Correção

### 1. `supabase/functions/envio-meta-massa-iniciar/index.ts`
- Remover o filtro que exclui instâncias RED/YELLOW **quando `modoRajada=true`**. Manter apenas para o modo serial.
- No rajada, só bloquear instâncias com `estado_pool='restrita'` cuja pausa tenha motivo diferente de qualidade (status Meta banido/restrito).

### 2. `supabase/functions/envio-meta-massa-burst/index.ts`
- Trocar o gate de "instância pausada" (linhas 176–195). Só encerrar o worker se:
  - `estado_pool='restrita'`, **ou**
  - `pausa_automatica_motivo` começar com `status=` (ex. `status=BANNED`, `status=FLAGGED`, `status=RESTRICTED`).
- Ignorar completamente pausas com motivo `quality=YELLOW`, `quality=RED` ou `quality=RED em irmão`.
- Continuar respeitando `rate_limit_ate` (esse é da Meta, não da qualidade).

### 3. `supabase/functions/send-whatsapp-meta/index.ts`
- Aceitar novo campo opcional no body: `ignorar_pausa_qualidade: true` (só o burst envia).
- Quando `ignorar_pausa_qualidade=true`: pular o bloqueio de `estado_pool !== 'ativo'` e de `pausa_automatica_ate` **se o motivo da pausa começar com `quality=`**. Se for `status=BANNED/FLAGGED/RESTRICTED`, continuar bloqueando (retornando `instance_restricted:true` para o burst encerrar aquela instância).
- `envio-meta-massa-burst` passa `ignorar_pausa_qualidade: true` no payload do fetch para `send-whatsapp-meta`.

### 4. `envio-meta-massa-retry-erros` (já OK)
Já devolve itens de `erro → pendente`, zera tentativas, reabre o job e re-dispara o burst por instância. O usuário disse que ele mesmo vai reativar depois — está coerente. Nenhuma mudança necessária aqui.

### 5. Frontend (`CampanhaDetalheDialog.tsx`) — nenhuma mudança
O botão "Tentar novamente" já chama `retry-erros` + `recarregarItensJob`, e a lista de erros se limpa quando os itens saem do status `erro`. Não mexer.

## Efeito esperado

- No próximo envio rajada com uma instância caindo para RED/YELLOW: o disparo **continua** por essa instância até a Meta de fato responder com bloqueio (restricted/banned) — aí a instância é retirada e as outras seguem.
- Se o WhatsApp for banido no meio, o worker daquela instância encerra sozinho (via `instance_restricted:true`); as demais continuam normalmente.
- Ao clicar "Tentar novamente" nos 3 erros da lista: eles voltam para pendente, a lista de erros esvazia e o job volta a `rodando` — o usuário reativa e o envio continua.

## Fora do escopo

Sem mudanças em `check-meta-instance-health` (a auto-pausa por qualidade continua existindo para o modo serial/lembretes, onde faz sentido preservar a saúde). Sem mudanças em `envio-meta-massa-tick`.
