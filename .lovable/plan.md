## Diagnóstico

Verifiquei os áudios enviados pela aba **Inbox Meta**. Encontrei 6 áudios recentes com `status_envio = 'erro'` e mensagem retornada pela Meta: **"Media upload error"**. Todos falharam por incompatibilidade de formato:

- Arquivos `.webm` (5 casos) — Meta **rejeita explicitamente** `audio/webm`.
- Arquivo `.m4a` (1 caso, o mais recente) — `audio/mp4` gerado pelo `MediaRecorder` do Chrome tem estrutura que a Meta recusa na validação pós-upload.

O caminho confiável aceito pela Meta para nota de voz é **`audio/ogg;codecs=opus`** (mesmo formato usado pelo WhatsApp nativo). Hoje o hook `useMetaAudioRecorder` já tenta esse formato primeiro, mas quando o navegador não suporta (Safari/iOS, ou Chrome em máquinas sem o mux de OGG), ele cai para `audio/mp4`/`audio/webm` e a Meta recusa.

Além disso, quando a Meta aceita o envio inicial mas o **webhook posterior** marca `failed` (o que aconteceu nesses casos), o usuário não recebe nenhum toast — a bolha simplesmente aparece com o pequeno ícone de erro, dando a impressão de que "áudio não funciona".

## Plano de correção

### 1. Forçar OGG/OPUS no cliente (`src/hooks/useMetaAudioRecorder.tsx`)
- Se o navegador suportar `audio/ogg;codecs=opus`, gravar direto em OGG (fluxo atual mantido).
- Se **não** suportar (Safari/iOS ou variantes de Chrome sem OGG), gravar em `audio/webm;codecs=opus` e, antes de enviar, **remuxar para OGG** usando `ffmpeg.wasm` (`@ffmpeg/ffmpeg` + `@ffmpeg/util` via esm.sh) — mesma codec Opus, apenas troca de contêiner, rápido e sem re-encode.
- Como último fallback (nenhum Opus disponível), continuar aceitando `audio/mp4`/`audio/aac`.
- Enviar sempre com extensão/`contentType` coerentes com o arquivo real.

### 2. Endurecer o edge function (`supabase/functions/send-whatsapp-meta-media/index.ts`)
- Rejeitar `audio/webm` já no cliente **e** no servidor com mensagem clara ("Regrave o áudio — o navegador enviou em formato incompatível").
- Ao chamar `POST /PHONE_ID/media`, validar o `content-type` retornado pelo Storage (não confiar só na extensão da URL) e logar payload de erro da Meta para futuros diagnósticos.

### 3. Feedback ao usuário quando a Meta marca `failed` depois do envio
- No `InboxMeta.tsx`, no realtime da tabela `meta_whatsapp_mensagens`, quando uma mensagem própria (direção `saida`) mudar para `status_envio = 'erro'` com `erro = 'Media upload error'` (ou qualquer erro), disparar um toast: *"O WhatsApp recusou o áudio. Grave novamente."*.

### 4. Teste
Após deploy, gravar um áudio de teste em uma conversa aberta (janela 24h ativa) para validar:
- Envio no Chrome (deve produzir `.ogg` direto).
- Envio no Safari (deve gerar `.webm` e remuxar para `.ogg` antes de subir).
- Verificar `status_envio = 'entregue'` na tabela após o webhook.

### Detalhes técnicos
- ffmpeg.wasm adiciona ~25 MB carregados sob demanda apenas na primeira gravação em navegadores sem OGG — carregamento lazy dentro do `finalizarGravacao`, sem impacto no bundle inicial.
- Nenhuma alteração de RLS, migrations ou custos de Lovable Cloud envolvidos.

### Arquivos afetados
- `src/hooks/useMetaAudioRecorder.tsx` (transcodificação client-side, mimetypes)
- `src/pages/InboxMeta.tsx` (toast ao detectar status_envio = 'erro' no realtime)
- `supabase/functions/send-whatsapp-meta-media/index.ts` (validação/logs)