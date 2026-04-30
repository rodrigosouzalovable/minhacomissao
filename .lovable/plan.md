## Objetivo
No WhatsApp Inbox, garantir que apenas um áudio toque por vez. Ao iniciar a reprodução de um novo áudio, qualquer áudio anterior deve pausar automaticamente.

## Arquivo afetado
- `src/components/inbox/WhatsAppAudioPlayer.tsx`

## Implementação
Adicionar um mecanismo simples de "single-player" usando `CustomEvent` no `window`, sem necessidade de Context global:

1. **Ao dar play (`togglePlay`)**: antes de iniciar, disparar `window.dispatchEvent(new CustomEvent('wa-audio-play', { detail: { messageId } }))`.
2. **No `useEffect` de montagem**: registrar listener para `wa-audio-play`. Se o `detail.messageId` for diferente do `messageId` deste player e o áudio estiver tocando, executar `audio.pause()` e `setPlaying(false)`.
3. **Listener adicional `pause`/`play` nativos do `<audio>`**: já existem implicitamente, mas vamos sincronizar `playing` com eventos `pause` e `play` para refletir corretamente o estado quando outro player pausar este.
4. **Cleanup**: remover o listener no unmount.

## Comportamento resultante
- Tocar áudio A → A toca.
- Tocar áudio B enquanto A toca → A pausa (mantendo posição), B começa do ponto atual.
- Continua funcionando seek, controle de velocidade e replay.

## Fora de escopo
- Não altera ChatInputBar (gravação) nem MensagensRapidasDialog (player de prévia separado).
