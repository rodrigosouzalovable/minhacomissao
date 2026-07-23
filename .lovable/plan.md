## Problema

Todos os áudios enviados pelo Inbox Meta oficial são **aceitos pela Meta** (retornam `wamid`, `status_envio='enviada'`), porém nunca avançam para `entregue`/`lida` — nem hoje, nem ontem, nem anteontem. Imagens/textos da mesma instância chegam normalmente. Isso é o padrão clássico de **OGG malformado**: a Meta aceita o upload, gera wamid, mas o WhatsApp do destinatário descarta silenciosamente o container inválido.

Duas causas foram identificadas no código atual (`useMetaAudioRecorder.tsx` + `send-whatsapp-meta-media/index.ts`):

1. **Remux por cópia (webm→ogg com `-c:a copy`)**: opus dentro de webm usa framing diferente do opus em ogg. Copiar sem re-encodar produz um `.ogg` tecnicamente inválido — Meta aceita (não valida no upload), WhatsApp não reproduz.
2. **Gravações "audio/ogg;codecs=opus" direto do navegador**: passam sem qualquer normalização, mas Chrome/Firefox produzem OGG com page-size irregular que também falha em alguns clientes WhatsApp.
3. **Sem normalização de sample rate/canais**: WhatsApp espera OGG/OPUS **16 kHz, mono, ~32 kbps**. Qualquer variação aumenta chance de rejeição silenciosa.

Além disso, o path no Storage está sendo salvo com `.ogg; codecs=opus` (o `mimeType` cru vira parte do nome do arquivo) — não é a causa da não-entrega (o upload à Meta é multipart, não por link), mas suja o bucket e é fácil arrumar junto.

## O que vai mudar

### 1. `src/hooks/useMetaAudioRecorder.tsx` (frontend)

- Sempre re-encodar para OGG/OPUS 16 kHz mono 32 kbps via `ffmpeg.wasm`, independente do container de entrada — remover o "fast path" que ship o blob cru sem transcodar.
- Argumentos ffmpeg: `-i in.<ext> -vn -ac 1 -ar 16000 -c:a libopus -b:a 32k -application voip out.ogg`.
- Corrigir o path do Storage para não interpolar mimeType (usar sempre `.ogg`).
- Manter `contentType: 'audio/ogg'` no upload (sem `; codecs=…`).

### 2. `supabase/functions/send-whatsapp-meta-media/index.ts` (backend)

- No `uploadAudioToMeta`, forçar `Content-Type: audio/ogg` no `Blob` da parte `file` (hoje pega do `guessAudioMime` que pode carregar sujeira do path).
- Adicionar `console.log` do tamanho do buffer, MIME final e resposta da Meta para diagnóstico.
- Se a Meta devolver erro no upload, propagar mensagem detalhada ao frontend (já existe, só reforçar).

### 3. Nenhuma mudança em contratos, DB ou UI

Sem migrations, sem novas colunas, sem alteração de layout. Só a lógica de preparação/upload de áudio.

## Verificação após implementar

1. Gravar um áudio curto no Chrome no `/admin/inbox-meta` e enviar para o `62991672674`.
2. Confirmar no log do `send-whatsapp-meta-media` que o MIME final foi `audio/ogg` e o upload retornou `id`.
3. Confirmar no banco que `status_envio` avança de `enviada` → `entregue` → `lida` (agora que o webhook oficial está inscrito).
4. Confirmar no celular que o áudio toca (não é apenas um balão vazio).

## Detalhes técnicos

- `ffmpeg.wasm` já está carregado no hook (`getFFmpeg`) — só ajusta os args e remove o atalho de "copy".
- Custo: cada envio de áudio já rodava ffmpeg.wasm para webm; agora rodará para ogg/mp4 também (+1-2s no envio). Sem impacto em custo de backend/Lovable Cloud.
- Não mexe em nada relacionado a UAZAPI, aquecimento, cotações ou envio em massa.