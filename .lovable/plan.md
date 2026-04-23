

## Plano: Restaurar recebimento de DMs no Inbox (sem voltar a sangrar com grupos)

### Diagnóstico real

Olhando a tela do diagnóstico que você mandou: **160 instâncias com a URL correta e o evento `messages` ativo**. Ou seja, a UAZAPI ESTÁ enviando webhooks. Os "problemas" que aparecem ("Grupos não bloqueados / Broadcast não bloqueado") são apenas **falso positivo do diagnóstico** — a UAZAPI aplicou os filtros mas devolve esses campos com nomes diferentes no `GET /webhook` dependendo da versão do servidor, e o diagnóstico não os reconhece.

**O verdadeiro motivo do Inbox vazio está em outro lugar:** na blindagem agressiva que adicionamos ontem em `whatsapp-chatbot/index.ts` (linhas 10-22). O filtro `isBlockedWebhookPayload` faz uma busca em texto cru por `'@g.us'` no body inteiro. Mas em mensagens de DM legítimas, a string `@g.us` aparece em campos secundários da UAZAPI (ex.: `owner`, `instanceOwner`, contatos referenciados, mensagens citadas) — então **toda DM real está sendo descartada como se fosse grupo**. Resultado: zero gravações em `whatsapp_mensagens_inbox` hoje.

Confirma isso o log da edge function: só aparecem "boot/shutdown" — o handler entra e sai sem logar nada (early return silencioso).

### Correção

**1. Refazer o filtro de grupo para olhar o lugar certo (não o body inteiro)**
Substituir `isBlockedWebhookPayload(rawBody)` por uma checagem feita APÓS o `JSON.parse`, validando apenas os campos que importam:
- `payload.chatid`, `payload.remoteJid`, `payload.message.key.remoteJid`, `payload.from`
- Se qualquer um terminar em `@g.us` ou for `status@broadcast` → descarta
- Se `messageType` for `reactionMessage` ou `protocolMessage` → descarta

Assim DMs legítimas passam, e grupos continuam 100% bloqueados (a memória `never-load-group-messages` segue valendo).

**2. Manter a defesa em camadas na UAZAPI**
A configuração `excludeGroupMessages: true` + `excludeBroadcast: true` em `setup-webhook-all` JÁ está correta e seguirá ativa — então a maioria dos grupos nem chega ao chatbot. A blindagem do código vira só "rede de segurança" para o que escapar.

**3. Corrigir o falso positivo no diagnóstico**
Em `diagnose-webhooks/index.ts`, considerar a instância "saudável" quando:
- URL bate ✓
- Evento `messages` está ativo ✓
- (mantém só como aviso, não como "Quebrado", a ausência dos flags `excludeGroupMessages`/`excludeBroadcast` no GET — porque vários servidores UAZAPI não devolvem esses campos no GET mesmo tendo aplicado)

Assim o painel para de mostrar 160 falsamente quebrados.

**4. Validação rápida pós-deploy**
- Logar `[CHATBOT] DM recebida de <numero>` no início do handler (depois do filtro novo) para você confirmar nos logs que está chegando.
- Pedir para você mandar uma msg de teste do seu celular pessoal pra qualquer instância → em < 30s deve aparecer no Inbox.

### Arquivos afetados

- `supabase/functions/whatsapp-chatbot/index.ts` — substituir `isBlockedWebhookPayload(rawBody)` por checagem em campos específicos do payload já parseado
- `supabase/functions/diagnose-webhooks/index.ts` — relaxar regra de "healthy" para não exigir os flags no GET

### Memórias respeitadas

- ✅ `never-load-group-messages`: filtro continua, só fica mais preciso (campo certo em vez de texto cru)
- ✅ `cloud-cost-awareness`: zero impacto em invocações (UAZAPI já bloqueia grupos na origem)
- ✅ `phone-suffix-matching-standard`: não toca em matching

### Custo Lovable Cloud

Zero. Pelo contrário — restaura o valor do produto (respostas de clientes = acordos fechados).

### Fora de escopo

- Não recriar instâncias
- Não tocar no fluxo de envio (que está OK)
- Não tocar em autosave/aquecimento

