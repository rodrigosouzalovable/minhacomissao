# Enviar áudio no Inbox Meta Oficial (corrigir a falha de envio)

O botão de microfone já existe na conversa (Enviar áudio / Enviar áudio transcrito), mas no Chrome do computador a gravação falha na hora de enviar.

## Por que falha

O Chrome só grava em WebM, formato que a API oficial da Meta não aceita. Hoje o sistema tenta converter esse WebM para OGG/OPUS dentro do navegador usando o conversor ffmpeg.wasm, carregado de um CDN externo e dependente de recursos avançados do navegador (memória compartilhada / worker). Quando esse carregamento falha ou expira, o código cai no aviso "Não foi possível preparar o áudio" e o áudio nunca chega ao envio — exatamente o erro relatado. O envio no servidor já está pronto e correto: ele sobe o binário para a Meta e aceita OGG, MP3, M4A, AAC e AMR.

## O que será feito

1. Trocar a conversão pesada por uma conversão nativa e confiável no navegador: o áudio gravado é decodificado pelo próprio Chrome (Web Audio) e re-codificado em MP3 (mono, bitrate leve) com uma biblioteca JavaScript pura, sem CDN externo nem recursos especiais do navegador. MP3 é aceito pela Meta.
2. Manter o caminho direto quando o navegador já grava em formato aceito (Safari grava M4A/AAC): nesses casos nada é convertido.
3. Manter o ffmpeg apenas como último recurso opcional — se a nova conversão MP3 falhar por algum motivo, tenta o caminho antigo antes de mostrar erro.
4. Melhorar a mensagem de erro para dizer o motivo real (falha ao converter, falha no upload ou recusa da Meta), em vez do aviso genérico atual.
5. Testar o envio real numa conversa dentro da janela de 24h e conferir se o áudio aparece no histórico do Inbox como mensagem de saída.

## Detalhes técnicos

- `src/hooks/useMetaAudioRecorder.tsx`: substituir `ensureMetaAudio` por um pipeline `AudioContext.decodeAudioData` → downmix mono → `lamejs` (`Mp3Encoder`, 22.05 kHz/64 kbps) → `Blob` `audio/mpeg`, extensão `.mp3`; ffmpeg fica como fallback secundário. Erros passam a propagar a causa no toast.
- Dependência nova: `lamejs` (ou `@breezystack/lamejs`), ~50 KB, carregada por import dinâmico só ao enviar áudio.
- `supabase/functions/send-whatsapp-meta-media/index.ts`: nenhuma mudança necessária — `guessAudioMime` já mapeia `.mp3` para `audio/mpeg` e faz o upload multipart para a Meta.
- Upload continua em `inbox-media` com URL assinada (`uploadInboxMedia`), sem alterar as regras do bucket privado.
