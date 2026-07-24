# Alerta de mensagem não entregue (Inbox Meta)

## Diagnóstico do caso 6299709475

Confirmado no banco:

- 23/07 21:06 — 2 mensagens **de entrada** do cliente ("Boa tarde", "Quero negociar…") → `status=entregue`.
- 24/07 08:33 — saída "Bom dia, tudo bem?…" → `wa_message_id` recebido da Meta, mas `status_envio = enviada` (nunca avançou para `entregue`/`lida`/`erro`).
- 24/07 09:39 — saída "Olá" → `status_envio = entregue`.

A Meta aceitou a mensagem das 08:33 (retornou `wamid`), mas **nunca enviou callback `delivered`/`read`/`failed`** para o webhook. Isso é comportamento clássico quando:

1. O aparelho do cliente está offline por muito tempo e a Meta expira a entrega silenciosamente, **ou**
2. O cliente ainda não tocou a “balãozinho de conversa segura” da Meta (business‑initiated conversation) e o app filtra a mensagem para uma pasta lateral, **ou**
3. O cliente bloqueou/silenciou o número após aceitar (o print do celular do usuário mostra que o número **não está nos contatos** e aparece o cartão "Bloquear / Adicionar", o que reforça o cenário 2).

Não há bug no envio: a Meta confirmou recebimento com `wamid`. O que falta é o app **avisar visualmente** quando o status parar em `enviada` por tempo demais — hoje o balão fica com o mesmo visual de "entregue".

## O que vai mudar

Somente frontend do Inbox Meta (`src/pages/InboxMeta.tsx` + o renderer de bolha usado por ele). Sem mexer em webhook, envio ou schema.

1. **Regra visual "não entregue"**
   - Considerar uma mensagem de saída como *possivelmente não entregue* quando:
     - `direcao = 'saida'` **e**
     - `status_envio = 'enviada'` (nunca virou entregue/lida/erro) **e**
     - `timestamp_msg` tem mais de **15 minutos** no passado.
   - Mensagens com `status = 'erro'` já continuam mostrando o motivo do erro (comportamento atual preservado).

2. **Indicador na própria bolha**
   - Ícone de alerta âmbar ao lado do horário + tooltip: *"Aceita pela Meta mas ainda não entregue ao aparelho do cliente."*
   - Mantém o check simples (✓) que já existe para `enviada`.

3. **Aviso inline na conversa**
   - Logo abaixo da bolha da mensagem afetada, uma linha centralizada em texto miúdo âmbar:
     *"⚠️ Esta mensagem pode não ter sido entregue ao WhatsApp do cliente. Isso costuma acontecer quando o aparelho está offline há muito tempo ou o cliente ainda não abriu a conversa iniciada pela empresa."*
   - Só aparece para a mensagem mais recente em estado "não entregue" de cada dia, para não poluir a conversa.

4. **Atualização automática**
   - O componente já revalida via Realtime; a regra é derivada do `status_envio` + `timestamp_msg`, então quando a Meta finalmente disparar `delivered` o alerta some sozinho.

## Fora do escopo

- Não vamos alterar o webhook nem "forçar" reentrega — a Meta não expõe reenvio para business‑initiated. Reenviar tem que ser ação humana (o operador manda de novo/usa template).
- Sem novas tabelas, sem cron novo, sem custo adicional em Lovable Cloud.

## Detalhes técnicos

- Arquivos tocados: `src/pages/InboxMeta.tsx` (renderização das bolhas de saída) e, se aplicável, o subcomponente de bolha Meta em `src/components/inbox/meta/` (ex.: onde hoje renderiza o `✓` de status).
- Regra fica em um helper local `isPossivelmenteNaoEntregue(msg)` para reuso.
- Threshold de 15 min fica em constante no topo do arquivo (`NAO_ENTREGUE_MIN = 15`) para ajuste fácil depois.
- Nenhuma mudança de dados / RLS / grants.
