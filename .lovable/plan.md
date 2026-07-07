## Objetivo

Três correções no **Inbox Meta Oficial** (`/admin/inbox-meta`):

1. Prefixar todo texto enviado por um atendente com `*Atendente {nome}:*` em negrito.
2. Corrigir a **gravação/envio de áudio**, que hoje falha com "Não foi possível preparar o áudio" (conversão OGG/OPUS via ffmpeg.wasm carregado do esm.sh).
3. Corrigir o **botão de transcrever áudio** — o texto transcrito não aparece no campo de digitação.

---

## 1) Prefixo `*Atendente {nome}:*` nas mensagens enviadas

**Arquivo:** `src/pages/InboxMeta.tsx`

- Adicionar `const [atendenteNome, setAtendenteNome] = useState<string>('')`.
- Em um `useEffect` disparado por `user`, buscar `profiles.nome` do usuário logado (`select nome from profiles where id = user.id`) e guardar no estado. Primeiro nome apenas (split no primeiro espaço) — usuário exemplificou "Anna Flavia", que é o `nome` completo do atendente.
- Criar helper `formatarMensagemAtendente(t: string)`:
  - Se `t` já começar com `*Atendente ` → retornar `t` inalterado (evita duplicidade em respostas rápidas / colagens).
  - Caso contrário → retornar `` `*Atendente ${atendenteNome}:*\n\n${t}` ``.
- Aplicar em `enviar()` antes de montar `tempMsg` e antes de mandar ao edge function `send-whatsapp-meta-text` (o `conteudo` salvo e o `texto` enviado ficam idênticos ao que o cliente vê no WhatsApp).
- **Não aplicar** em mídia/áudio/documento — o pedido do usuário é sobre a mensagem de texto no topo. Legendas de mídia ficam como estão.
- Se `atendenteNome` estiver vazio (perfil sem nome), enviar sem prefixo (fallback silencioso).

## 2) Áudio: gravação, conversão e envio

**Arquivo:** `src/hooks/useMetaAudioRecorder.tsx`

Causa atual: o hook carrega `@ffmpeg/ffmpeg` **em runtime** via `https://esm.sh/...` — esse import falha em muitos ambientes (CSP, rede, versão do core.wasm) e cai no toast vermelho da imagem enviada.

Correções:

- **Remover import remoto do esm.sh.** Passar a importar `@ffmpeg/ffmpeg` e `@ffmpeg/util` como pacotes normais do bundle (adicionar via `bun add @ffmpeg/ffmpeg @ffmpeg/util` — permitido em build mode). O `coreURL/wasmURL` continua vindo do CDN oficial, mas via `toBlobURL` do pacote local.
- Reforçar a **ordem de mime types** para priorizar formatos que a Meta já aceita nativamente e evitar depender do ffmpeg quando possível:
  - No Safari (iOS/macOS), `audio/mp4` é suportado e **aceito pela Meta** — fast path sem ffmpeg.
  - No Chrome/Edge/Firefox, ainda precisamos remuxar `audio/webm;codecs=opus` → `audio/ogg` (fast copy, sem re-encode).
- Ajustar `ensureOggOpus` para retornar o arquivo original quando `mimeType.includes('mp4')` (Meta aceita mp4/aac) — evita rodar ffmpeg no Safari.
- Melhorar mensagem de erro: quando a conversão realmente falhar, incluir o mimeType real capturado (facilita diagnóstico).

**Envio:** o resto do fluxo (`upload → getPublicUrl → invoke send-whatsapp-meta-media`) permanece igual; só precisamos garantir que o blob final tenha um `contentType` que a Meta aceite (`audio/ogg` ou `audio/mp4`).

## 3) Botão de transcrever — texto não aparece no composer

**Arquivos:** `src/pages/InboxMeta.tsx` e `src/components/inbox/meta/MetaComposer.tsx`

Investigação:

- `finalizarGravacao` chama `audioRec.transcreverGravacao()` e, se retornar texto, faz `composerRef.current?.appendText(texto)`.
- Hoje o `MetaComposer` está envolvido em `memo(forwardRef(...))`. O `useImperativeHandle` tem deps `[]`, então o handle é estável — mas se `composerRef` for nulo por algum motivo (por exemplo, o composer desmontou durante a gravação porque `janelaInfo.aberta` virou `false`), o `appendText` cai silenciosamente.

Correções:

- No `MetaComposer`: adicionar `console` de guarda e garantir que `appendText` **sempre** foque o textarea, mesmo se o texto foi appendado antes do próximo `requestAnimationFrame`. Trocar `requestAnimationFrame` por `setTimeout(..., 0)` como fallback quando o componente acabou de montar.
- No `InboxMeta`:
  - Após chamar `audioRec.transcreverGravacao()`, se `texto` vier e `composerRef.current` for `null` (fallback), guardar o texto em um estado `pendingTranscricao` e passá-lo ao `MetaComposer` como `initialText` (nova prop opcional), que o composer aplica dentro de um `useEffect`.
  - Adicionar `initialText?: string` em `MetaComposer`; quando muda, faz `setTexto(prev => prev ? `${prev} ${initialText}` : initialText)` e reseta o estado no pai.
- Manter o toast "Áudio transcrito — revise o texto e clique em enviar".

## Detalhes técnicos

- Prefixo é aplicado **apenas em `enviar()`** (texto). Templates HSM e mídia não são tocados.
- `profiles.nome` já é lido em outras telas do projeto — RLS permite `select` do próprio perfil.
- `bun add @ffmpeg/ffmpeg @ffmpeg/util` é obrigatório antes de mexer no hook; sem isso o import quebra o build.
- Nenhuma alteração de schema, RLS ou edge function.
- Nenhuma alteração no `MetaAtendenteNotifier` nem no auto-rodízio de etiquetas.

## Arquivos alterados

- `src/pages/InboxMeta.tsx` — carregar nome do atendente, prefixar texto, passar `initialText` ao composer.
- `src/components/inbox/meta/MetaComposer.tsx` — nova prop `initialText`, `appendText` mais robusto.
- `src/hooks/useMetaAudioRecorder.tsx` — imports locais do ffmpeg, fast path para `audio/mp4`, mensagens de erro melhores.
- `package.json` — dependências `@ffmpeg/ffmpeg` e `@ffmpeg/util`.
