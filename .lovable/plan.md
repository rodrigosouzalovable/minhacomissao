## Objetivo

Quando uma instância de WhatsApp conectar pela primeira vez (ou reconectar após estar desconectada), o sistema importa automaticamente as **últimas 10 conversas individuais** (sem grupos / sem status / sem broadcast), pegando as **20 mensagens mais recentes** de cada uma. Tudo entra como **não lido** no WhatsApp Inbox.

## Aviso de custo (regra do projeto)

Cada importação faz ~10 chamadas à UAZAPI + até 200 inserts em `whatsapp_mensagens`. Por instância isso é leve; **se 50 instâncias conectarem ao mesmo tempo, são até 10.000 inserts**. Para conter:

- Importação rodará **apenas 1 vez por instância** (controlado por flag persistida no banco — não roda toda vez que reconectar).
- Cap de 10 conversas × 20 mensagens. Sem retentativa automática se a UAZAPI não suportar.
- Filtro estrito de grupos/status/broadcast em 3 camadas, conforme regra de memória.

## Limitações da UAZAPI (importante saber antes)

A função existente `fetch-whatsapp-history` já tenta 7 endpoints e em algumas instâncias **todos retornam 404/405** — a própria função tem uma flag `api_supported: false` para esse caso. Em servidores UAZAPI que não expõem histórico, o resultado da importação será 0 conversas e o usuário verá um toast explicando.

## Mudanças

### 1. Migration — flag de "já importou"

Nova coluna em `user_whatsapp_instances`:

```sql
ALTER TABLE user_whatsapp_instances
  ADD COLUMN IF NOT EXISTS historico_inicial_importado_em timestamptz;
```

Quando preenchida, a importação automática não roda de novo para essa instância.

### 2. Nova edge function — `import-recent-whatsapp-chats`

`supabase/functions/import-recent-whatsapp-chats/index.ts`. Recebe `{ instancia_id }`, faz:

```text
1. Lê server_url + instance_token de user_whatsapp_instances
2. Verifica se historico_inicial_importado_em IS NULL (senão retorna {skipped:true})
3. Chama UAZAPI /chat/find (e fallbacks) para listar chats da instância
4. Filtra: descarta @g.us, status@broadcast, qualquer JID de grupo
5. Ordena por última mensagem desc, pega top 10
6. Para cada chat: GET /chat/find com count=20 → parseia mensagens
   (mesmo parser de fetch-whatsapp-history: imageMessage, audioMessage, etc)
7. Insere em whatsapp_mensagens com lida=false em TODAS as mensagens
   (entrada e saída — conforme escolhido pelo usuário)
8. Deduplica por (timestamp_msg, direcao, conteudo[:100])
9. Marca historico_inicial_importado_em = now() na instância
10. Retorna { imported_chats, imported_messages, api_supported }
```

CORS conforme padrão. Erros de UAZAPI desconectada → `HTTP 200 + fallback:true` (regra de memória).

### 3. Trigger automático no frontend

Em `src/pages/WhatsAppInbox.tsx`, no mesmo `useEffect` que já roda o `test-uazapi-connection` quando o dialog "Nova conversa" abre (e em qualquer outro ponto que verifica conexão), quando uma instância passa de **desconectada → conectada**:

```ts
// Pseudo:
if (estavaDesconectada && agoraConectada && !inst.historico_inicial_importado_em) {
  supabase.functions.invoke('import-recent-whatsapp-chats', {
    body: { instancia_id: inst.id }
  }).then(({ data }) => {
    if (data?.imported_chats > 0) {
      toast.success(`${data.imported_chats} conversas importadas como não lidas`);
    } else if (data?.api_supported === false) {
      toast.info('Esta instância não permite importar histórico');
    }
  });
}
```

Detecção do "estavaDesconectada → conectada" usa estado já mantido em `instanciasConectadas` (introduzido no commit anterior do dialog Nova Conversa). Vou centralizar isso em um pequeno hook `useInstanceConnectionWatcher` para reuso.

### 4. Reset manual (opcional, para debug)

Botão pequeno em ⚙️ da instância: "Reimportar últimas conversas" — limpa `historico_inicial_importado_em` e dispara de novo. Útil pra você testar.

## Arquivos a alterar/criar

- `supabase/migrations/<timestamp>_historico_importado.sql` — nova coluna.
- `supabase/functions/import-recent-whatsapp-chats/index.ts` — nova função (reaproveita lógica de parsing de `fetch-whatsapp-history`).
- `src/pages/WhatsAppInbox.tsx` — disparo automático ao detectar conexão nova.
- `src/hooks/useInstanceConnectionWatcher.ts` (novo) — encapsula a detecção desconectada→conectada.

## Sem mudanças em

- `whatsapp_mensagens` (schema atual já comporta).
- `fetch-whatsapp-history` (continua existindo para uso pontual de 1 telefone).
- Webhook em tempo real (mensagens novas continuam chegando como hoje).

## Confirmações que vou seguir conforme você respondeu

- **Gatilho**: automático ao instância conectar (1× só, controlado por flag no banco).
- **Profundidade**: 20 mensagens por conversa.
- **Status leitura**: tudo (entradas + suas próprias saídas) entra como `lida = false`.

## Coisas que NÃO vou fazer

- Não vou rodar em loop nem em cron — só no momento exato da conexão.
- Não vou importar grupos, status, broadcasts nem newsletters em hipótese alguma.
- Não vou criar botão "Importar agora" geral no Inbox (a reimportação fica só no ⚙️ da instância, escondida, pra evitar cliques acidentais que gerem custo).
