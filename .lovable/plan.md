
## Objetivo
Habilitar no Inbox Meta Oficial, dentro de cada conversa, os mesmos dois modos de gravação de voz que já existem no WhatsApp Inbox:
1. **Enviar áudio** — grava e envia como mensagem de voz na conversa.
2. **Enviar áudio transcrito** — grava, transcreve e coloca o texto no campo de digitação para edição antes do envio.

## Mudanças

### 1. `src/components/inbox/meta/MetaComposer.tsx`
- Expor um método imperativo `appendText(t)` via `forwardRef` + `useImperativeHandle`, para que o pai consiga injetar o texto transcrito no `<Textarea>` (mantendo o estado interno que evita lag de digitação).

### 2. `src/pages/InboxMeta.tsx`
- Reutilizar o hook `useAudioRecorder`, mas como o hook atual chama a edge `send-whatsapp-audio` (UAZAPI), criaremos um wrapper Meta:
  - Um novo hook leve `useMetaAudioRecorder` (ou uma variação inline no componente) que:
    - Grava com `MediaRecorder` (`audio/ogg;codecs=opus` preferencial — compatível com WhatsApp Cloud API; fallback webm).
    - No modo "enviar": faz upload em `inbox-media` (`meta/…/timestamp.ogg`) e chama `send-whatsapp-meta-media` com `type: 'audio'` (já suportado).
    - No modo "transcrever": envia base64 para `transcribe-audio` (edge já existente) e devolve o texto.
    - Estados: `gravando`, `tempoGravacao`, `enviandoAudio`, `transcrevendo`, `formatTempo`, além de `iniciar/cancelar/finalizar`.
- No composer da conversa Meta:
  - Substituir o ícone único do microfone por um `DropdownMenu` com dois itens:
    - "Enviar áudio" (ícone `AudioLines`)
    - "Enviar áudio transcrito" (ícone `FileText`)
  - Quando `gravando` ou `transcrevendo`: trocar a barra do composer por um painel com timer, botão cancelar (X) e botão confirmar (Send / Loader).
  - Ao confirmar em modo "transcrito": chamar `metaComposerRef.current?.appendText(textoTranscrito)` para preencher o campo.
  - Bloquear a gravação quando `janelaInfo.aberta === false` (mesma regra dos demais envios).
  - O botão do microfone só aparece quando o campo está vazio (comportamento igual ao `ChatInputBar` do WhatsApp Inbox); quando houver texto, mostra o botão de enviar do `MetaComposer`.

## Detalhes técnicos
- MIME: `MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')` → usa `.ogg`; senão `.webm` (a Meta aceita `audio/ogg` opus como voz; para `.webm` o Meta Cloud pode não reproduzir como voice note — deixaremos o `.ogg` como preferencial e caímos em `.webm` com aviso).
- Upload para bucket `inbox-media`, path `meta/{instancia_id}/{telefone}/{ts}.{ext}` (já usado pelo `enviarMidia`).
- Envio via edge `send-whatsapp-meta-media` já existente (parâmetros: `instancia_id`, `telefone`, `media_url`, `type: 'audio'`, `user_id`, opcional `reply_to_wa_id`/`conteudo_citado`).
- Transcrição via edge `transcribe-audio` já existente (mesmo fluxo do hook do WhatsApp Inbox).
- Nenhuma alteração de schema ou de edge functions é necessária.

## Arquivos afetados
- `src/pages/InboxMeta.tsx` — dropdown do microfone, painel de gravação, integração.
- `src/components/inbox/meta/MetaComposer.tsx` — expor ref com `appendText`.
