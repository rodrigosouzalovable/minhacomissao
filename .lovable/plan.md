## Diagnóstico

Verifiquei o banco em tempo real e confirmei:

- **As mensagens recebidas dos clientes ESTÃO sendo gravadas corretamente** em `whatsapp_mensagens` (195 textos de entrada nas últimas 6 horas, a mais recente há minutos).
- A tabela `whatsapp_contatos` também está sendo atualizada (última `ultima_mensagem_em` = agora).
- O webhook `whatsapp-chatbot` está rodando, processando e gravando normalmente.

Ou seja, **o problema não é no backend** — é no frontend do Inbox: **o canal Realtime do Supabase para de receber eventos depois de algum tempo** (perda de WebSocket por inatividade, troca de aba, sleep de tela, etc.) e não há reconexão nem polling de fallback. Isso bate com o sintoma "depois de certa hora não vejo nenhuma conversa nova".

### Causa raiz no código (`src/pages/WhatsAppInbox.tsx`)

1. **Canal `whatsapp-contatos-changes` (linhas 469–477)**: assina `INSERT/UPDATE/DELETE` em `whatsapp_contatos` mas:
   - Não monitora o status do canal (`SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`).
   - Não reconecta se o WebSocket cair.
   - Sem polling periódico — se o realtime morrer, a lista congela permanentemente até refresh manual.

2. **Canal `whatsapp-mensagens-changes` (linhas 572–595)**: mesmo problema — só `INSERT`, sem reconexão, sem polling.

3. **Aba inativa / sleep**: navegadores suspendem WebSockets em segundo plano. Quando o usuário volta, o canal está "morto" mas o React não sabe.

4. Não há `visibilitychange` listener para forçar refetch quando a aba volta a ficar visível.

## Plano de correção

### 1. Auto-recuperação dos canais Realtime
Em ambos os canais (`whatsapp-contatos-changes` e `whatsapp-mensagens-changes`):
- Capturar o status no `.subscribe((status) => ...)`.
- Se o status virar `CHANNEL_ERROR`, `TIMED_OUT` ou `CLOSED`, remover o canal e recriar após pequeno backoff (ex.: 2s, 5s, 10s).
- Ao reconectar, disparar `fetchContatos()` / `fetchMensagens()` para recuperar o que foi perdido enquanto offline.

### 2. Polling de fallback (cinto e suspensório, custo zero)
Adicionar `setInterval` leve:
- A cada **20 segundos**, chamar `fetchContatos()` em background (já filtra por instâncias do usuário, query rápida e barata).
- Se a conversa estiver aberta, a cada **15 segundos** buscar apenas mensagens **mais novas que a última no estado** (`gt('timestamp_msg', ultima)`), em vez de recarregar tudo. Isso garante zero perda mesmo se o WebSocket falhar e mantém o custo mínimo.

### 3. Reagir ao retorno da aba
Adicionar listener de `document.visibilitychange`:
- Quando a aba volta a ficar visível (`document.visibilityState === 'visible'`), chamar imediatamente `fetchContatos()` e `fetchMensagens()`, e re-subscrever os canais.

### 4. Indicador discreto de status
Pequeno ponto colorido no header do Inbox:
- Verde = realtime conectado.
- Amarelo = reconectando / usando polling.
Para o usuário saber se está em tempo real ou modo degradado, sem assustar.

## Arquivos a alterar

- `src/pages/WhatsAppInbox.tsx` — adicionar reconexão de canais, polling de fallback, listener de `visibilitychange`, indicador de status. **Nenhuma mudança no banco e nenhuma edge function nova.**

## O que NÃO muda

- Backend, edge functions, RLS, schema do banco.
- Lógica de envio, de gravação de mensagens, de mídia, etc.
- Não cria custo adicional relevante de Lovable Cloud (polling de 20s usa apenas a tabela `whatsapp_contatos` já indexada).

## Resultado esperado

- Mensagens de clientes aparecem em tempo real como hoje.
- **Se o WebSocket cair, em até 20s a lista se atualiza sozinha** via polling.
- Voltar de outra aba puxa as novidades imediatamente.
- Nunca mais "depois de certa hora não aparece nada".
