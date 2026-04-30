
# WhatsApp Inbox: envio estilo WhatsApp Web + checks de status

Hoje, ao enviar uma mensagem na Inbox:
1. O sistema chama a edge function `send-whatsapp` e **espera** a resposta antes de mostrar a mensagem na conversa.
2. Enquanto espera (e enquanto a mensagem temporária ainda não foi confirmada pelo `fetchMensagens`), o `hasPendingMessages` bloqueia a troca de conversa, exibindo "Aguarde, aguardando confirmação do envio...".
3. Não existe nenhum indicador visual de **enviada / entregue / lida** — só aparece a hora.

Vou mudar para o comportamento do WhatsApp Web: a mensagem aparece imediatamente na tela com um relógio (⏱), depois vira ✓ (enviada), ✓✓ (entregue) e ✓✓ azul (lida), sem nunca travar a interface.

---

## 1. Envio otimista (não bloqueia a UI)

Em `src/pages/WhatsAppInbox.tsx`, no `handleEnviarTexto`:

- Inserir a mensagem temporária (`temp-...`) **ANTES** de chamar a edge function, já com `status_envio: 'enviando'`.
- Limpar o input/respondendo imediatamente.
- Chamar `supabase.functions.invoke('send-whatsapp', ...)` **sem `await` bloqueante** — usar `.then/.catch` em background.
- Em sucesso: marcar a mensagem temp como `status_envio: 'enviada'` e disparar `fetchMensagens()` para reconciliar com a versão persistida.
- Em falha: marcar a mensagem como `status_envio: 'erro'` (com botão "tentar novamente") e mostrar toast.
- Remover `setEnviando(true/false)` em torno do envio — `enviando` deixa de bloquear globalmente.
- Atualizar `hasPendingMessages` para considerar **somente** mensagens com `status_envio === 'enviando'` (não bloquear se estiverem `enviada`/`erro`).
- Permitir `handleSelectContato` trocar de conversa mesmo com envios pendentes — eles continuam em background.

Mesmo tratamento para `handleMediaSent` (áudio, imagem, documento, atalhos).

## 2. Coluna de status no banco

Migração para adicionar status persistente nas mensagens enviadas:

```sql
ALTER TABLE public.whatsapp_mensagens
  ADD COLUMN IF NOT EXISTS status_envio text
    DEFAULT 'enviada'
    CHECK (status_envio IN ('enviando','enviada','entregue','lida','erro'));

CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_status_envio
  ON public.whatsapp_mensagens(instancia_id, whatsapp_msg_id)
  WHERE status_envio IN ('enviada','entregue');
```

Mensagens já existentes ficam como `enviada` (compatível). Mensagens recebidas (`direcao='entrada'`) ignoram esse campo.

## 3. Checks (✓ / ✓✓ / ✓✓ azul) no `ChatMessage.tsx`

Adicionar, abaixo do horário em mensagens com `direcao === 'saida'`:

```text
[hora]  [ícone de status]
   00:42 ⏱       (enviando — relógio)
   00:42 ✓       (enviada — 1 check cinza)
   00:42 ✓✓      (entregue — 2 checks cinza)
   00:42 ✓✓      (lida — 2 checks AZUIS)
   00:42 !       (erro — exclamação vermelha + tooltip "Tocar para reenviar")
```

Usar ícones do `lucide-react`: `Clock3`, `Check`, `CheckCheck`, `AlertCircle`. Cores via classes Tailwind (`text-primary-foreground/70` cinza padrão, `text-sky-300` azul para "lida").

## 4. Atualização do status (entregue / lida)

A UAZAPI envia callbacks de ACK (`messages.update` / `status`), mas o projeto **ainda não tem uma edge function de webhook próprio** — os ACKs hoje seriam ignorados.

Para ter ✓✓ e ✓✓ azul reais, criar uma nova edge function:

- **`supabase/functions/uazapi-webhook/index.ts`** (público, sem JWT):
  - Recebe POST da UAZAPI com eventos.
  - Quando o evento for de status (`messages.update`/`ack`/`status`), extrair `whatsapp_msg_id` e nova status (`DELIVERY_ACK` → `entregue`, `READ` → `lida`).
  - Atualizar `whatsapp_mensagens.status_envio` via service role.
  - Suportar também eventos `messages.upsert` / `messages` (mensagens recebidas) para já gravar diretamente no banco — passa a complementar o atual fluxo via histórico.
- Registrar o webhook nas instâncias UAZAPI usando endpoint `/instance/updateWebhook` (a URL será `https://<project>.functions.supabase.co/uazapi-webhook?instancia_id=<uuid>`).
- Criar botão admin opcional "Re-registrar webhooks" no painel de instâncias (fora do escopo se você quiser deixar para depois — me avise).

Quando a coluna `status_envio` muda, a Realtime subscription já existente em `whatsapp_mensagens` (ver código atual) vai propagar o update para a UI sem reload.

## 5. Realtime na UI

A página já assina Realtime de `whatsapp_mensagens`. Vou garantir que o handler de UPDATE atualize `status_envio` na lista local sem refetch completo, para os checks transitarem de ✓ → ✓✓ → ✓✓ azul ao vivo.

---

## Detalhes técnicos

- **Arquivos editados**:
  - `src/pages/WhatsAppInbox.tsx` (envio otimista, troca livre de conversa, propagação de status no realtime).
  - `src/components/inbox/ChatMessage.tsx` (renderização do ícone de status nas mensagens de saída).
  - `src/components/inbox/ChatInputBar.tsx` (não bloquear input/troca durante envio; remover spinners globais que travam — o spinner fica apenas dentro do balão).
  - `supabase/functions/send-whatsapp/index.ts` (gravar `status_envio: 'enviada'` na inserção, sem mudar fluxo).
  - `supabase/functions/send-whatsapp-media/index.ts`, `send-whatsapp-audio/index.ts`, `send-whatsapp-buttons/index.ts` (mesmo, gravar status inicial).

- **Arquivos criados**:
  - `supabase/migrations/<timestamp>_add_status_envio_whatsapp.sql`
  - `supabase/functions/uazapi-webhook/index.ts` (com `verify_jwt = false` em `supabase/config.toml`).

- **Não muda**: tabelas existentes (apenas coluna nova, default compatível), permissões, RLS, fluxo de mídia, fluxo de aquecimento.

- **Custo Lovable Cloud**: a nova função `uazapi-webhook` recebe ~1 chamada por evento (mensagem/ack). Para volume atual é desprezível (estimativa: alguns milhares de invocações/mês), bem abaixo do free tier. Sem novo storage. **Não há aumento relevante de custo.**

## O que o usuário verá depois

- Digitar e apertar Enter: a mensagem aparece **na hora** no balão, com ⏱.
- Logo vira ✓ (assim que UAZAPI confirma o envio).
- Trocar de conversa imediatamente, mesmo que o envio anterior ainda esteja em andamento — sem aviso "Aguarde".
- ✓✓ aparece quando o celular do contato recebe; fica azul quando ele lê — exatamente como WhatsApp Web.
- Se der erro de envio, ícone vermelho com tooltip explicativo (sem travar a interface).

Aprovar para eu implementar?
