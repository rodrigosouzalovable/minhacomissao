import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { uploadInboxMedia } from '@/lib/inboxMediaUrl';

interface UseMetaAudioRecorderProps {
  instanciaId: string;
  telefone: string;
  userId?: string;
  replyToWaId?: string;
  conteudoCitado?: string;
  onSent: () => void;
}

// Lazy-loaded ffmpeg.wasm instance — used only when the browser can record
// only WebM. Preferimos gravar direto em MP4/AAC porque a Meta aceita nativo e
// evita travar o envio tentando converter todo áudio no navegador.
let _ffmpegPromise: Promise<any> | null = null;
async function getFFmpeg(): Promise<any> {
  if (_ffmpegPromise) return _ffmpegPromise;
  _ffmpegPromise = (async () => {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { toBlobURL } = await import('@ffmpeg/util');
    const ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
    });
    return ffmpeg;
  })().catch((err) => {
    _ffmpegPromise = null;
    throw err;
  });
  return _ffmpegPromise;
}

function normalizeAudioMime(mimeType: string): { ext: 'ogg' | 'mp4' | 'm4a' | 'aac' | 'mp3' | 'webm'; contentType: string } {
  const lower = (mimeType || '').toLowerCase();
  if (lower.includes('ogg')) return { ext: 'ogg', contentType: 'audio/ogg' };
  if (lower.includes('aac')) return { ext: 'aac', contentType: 'audio/aac' };
  if (lower.includes('mpeg') || lower.includes('mp3')) return { ext: 'mp3', contentType: 'audio/mpeg' };
  if (lower.includes('mp4') || lower.includes('m4a')) return { ext: 'm4a', contentType: 'audio/mp4' };
  return { ext: 'webm', contentType: 'audio/webm' };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = window.setTimeout(() => reject(new Error(`${label} demorou demais`)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(id);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(id);
        reject(err);
      },
    );
  });
}

/** Decodifica o áudio com o próprio navegador e re-codifica em MP3 (aceito pela Meta). */
async function encodeToMp3(blob: Blob): Promise<Blob> {
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const AudioCtx: typeof AudioContext =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) throw new Error('Navegador sem suporte a Web Audio');
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const ch0 = decoded.getChannelData(0);
    const ch1 = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : null;
    const len = ch0.length;
    const pcm = new Int16Array(len);
    for (let i = 0; i < len; i++) {
      const sample = ch1 ? (ch0[i] + ch1[i]) / 2 : ch0[i];
      const clamped = Math.max(-1, Math.min(1, sample));
      pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }
    const encoder = new Mp3Encoder(1, decoded.sampleRate, 64);
    const parts: Uint8Array[] = [];
    const blockSize = 1152;
    for (let i = 0; i < pcm.length; i += blockSize) {
      const chunk = pcm.subarray(i, i + blockSize);
      const buf = encoder.encodeBuffer(chunk);
      if (buf.length > 0) parts.push(new Uint8Array(buf));
    }
    const tail = encoder.flush();
    if (tail.length > 0) parts.push(new Uint8Array(tail));
    const out = new Blob(parts as unknown as BlobPart[], { type: 'audio/mpeg' });
    if (out.size === 0) throw new Error('Conversão gerou arquivo vazio');
    return out;
  } finally {
    try { await ctx.close(); } catch { /* noop */ }
  }
}

async function ensureMetaAudio(
  blob: Blob,
  mimeType: string,
): Promise<{ blob: Blob; ext: 'ogg' | 'mp4' | 'm4a' | 'aac' | 'mp3'; contentType: string }> {
  const native = normalizeAudioMime(mimeType);
  // Meta aceita MP4/AAC/MP3 nativamente. Não passe por conversão nesses casos.
  if (native.contentType !== 'audio/webm' && native.contentType !== 'audio/ogg') {
    const ext = native.ext === 'webm' || native.ext === 'ogg' ? 'm4a' : native.ext;
    return { blob: new Blob([blob], { type: native.contentType }), ext, contentType: native.contentType };
  }

  // WebM (Chrome/Edge) não é aceito pela Meta e OGG do navegador já foi descartado
  // silenciosamente pelo WhatsApp: nos dois casos convertemos para MP3 no navegador.
  try {
    const mp3 = await withTimeout(encodeToMp3(blob), 60000, 'Conversão do áudio');
    return { blob: mp3, ext: 'mp3', contentType: 'audio/mpeg' };
  } catch (mp3Err) {
    console.warn('[useMetaAudioRecorder] falha na conversão MP3, tentando ffmpeg', mp3Err);
  }

  // Último recurso: ffmpeg.wasm (pode falhar em navegadores sem memória compartilhada).
  const ffmpeg = await withTimeout(getFFmpeg(), 30000, 'Carregamento do conversor de áudio');
  const lower = (mimeType || '').toLowerCase();
  const inExt = lower.includes('webm')
    ? 'webm'
    : lower.includes('ogg')
      ? 'ogg'
      : lower.includes('mp4') || lower.includes('m4a') || lower.includes('aac')
        ? 'm4a'
        : 'bin';
  const inName = `in.${inExt}`;
  const outName = 'out.ogg';
  const buf = new Uint8Array(await blob.arrayBuffer());
  await withTimeout(ffmpeg.writeFile(inName, buf), 10000, 'Preparação do áudio');
  await withTimeout(ffmpeg.exec([
    '-i', inName,
    '-vn',
    '-ac', '1',
    '-ar', '16000',
    '-c:a', 'libopus',
    '-b:a', '32k',
    '-application', 'voip',
    outName,
  ]), 45000, 'Conversão do áudio');
  const data = await withTimeout(ffmpeg.readFile(outName), 10000, 'Leitura do áudio convertido');
  const out = new Blob([data as unknown as BlobPart], { type: 'audio/ogg' });
  try { await ffmpeg.deleteFile(inName); await ffmpeg.deleteFile(outName); } catch { /* noop */ }
  return { blob: out, ext: 'ogg', contentType: 'audio/ogg' };
}



export function useMetaAudioRecorder({
  instanciaId, telefone, userId, replyToWaId, conteudoCitado, onSent,
}: UseMetaAudioRecorderProps) {
  const { toast } = useToast();
  const [gravando, setGravando] = useState(false);
  const [tempoGravacao, setTempoGravacao] = useState(0);
  const [enviandoAudio, setEnviandoAudio] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const iniciarGravacao = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Ordem preferida: MP4/AAC, que a API oficial aceita nativamente. WebM só
      // fica como fallback e será convertido para OGG/OPUS antes do envio.
      const candidatos = [
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/aac',
        'audio/webm;codecs=opus',
        'audio/webm',
      ];
      let rec: MediaRecorder | null = null;
      for (const mimeType of candidatos) {
        if (!MediaRecorder.isTypeSupported(mimeType)) continue;
        try {
          rec = new MediaRecorder(stream, { mimeType });
          break;
        } catch {
          rec = null;
        }
      }

      if (!rec) {
        stream.getTracks().forEach(t => t.stop());
        toast({
          title: 'Navegador não suporta gravação de áudio',
          description: 'Atualize seu Chrome/Edge/Safari e tente novamente.',
          variant: 'destructive',
        });
        return;
      }
      mediaRecorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.start();
      setGravando(true);
      setTempoGravacao(0);
      timerRef.current = setInterval(() => setTempoGravacao(t => t + 1), 1000);
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível acessar o microfone', variant: 'destructive' });
    }
  }, [toast]);

  const cancelarGravacao = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec) {
      try { rec.stop(); } catch { /* noop */ }
      rec.stream.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    chunksRef.current = [];
    setGravando(false);
    setTempoGravacao(0);
  }, []);

  const enviarGravacao = useCallback(async () => {
    const rec = mediaRecorderRef.current;
    if (!rec) return;
    return new Promise<void>((resolve) => {
      rec.onstop = async () => {
        rec.stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setGravando(false);
        const rawBlob = new Blob(chunksRef.current, { type: rec.mimeType });
        chunksRef.current = [];
        if (rawBlob.size === 0) { setTempoGravacao(0); resolve(); return; }
        setEnviandoAudio(true);
        try {
          let prepared: { blob: Blob; ext: 'ogg' | 'mp4' | 'm4a' | 'aac' | 'mp3'; contentType: string };
          try {
            prepared = await ensureMetaAudio(rawBlob, rec.mimeType || 'audio/ogg');
          } catch (convErr) {
            console.error('[useMetaAudioRecorder] falha ao preparar áudio', { convErr, mimeType: rec.mimeType });
            toast({
              title: 'Não foi possível preparar o áudio',
              description: `Formato "${rec.mimeType || 'desconhecido'}" — falha na conversão. Tente Chrome/Edge atualizado.`,
              variant: 'destructive',
            });
            resolve();
            return;
          }
          const path = `meta/${instanciaId}/${telefone}/${Date.now()}.${prepared.ext}`;
          const audioSignedUrl = await uploadInboxMedia(path, prepared.blob, prepared.contentType);
          const { data, error } = await supabase.functions.invoke('send-whatsapp-meta-media', {
            body: {
              instancia_id: instanciaId,
              telefone,
              media_url: audioSignedUrl,
              type: 'audio',
              user_id: userId,
              reply_to_wa_id: replyToWaId,
              conteudo_citado: conteudoCitado,
            },
          });
          if (error) throw new Error(error.message);
          if (!data?.success) throw new Error(data?.error || 'Falha ao enviar áudio');
          onSent();
        } catch (err: any) {
          toast({ title: 'Erro ao enviar áudio', description: err.message, variant: 'destructive' });
        } finally {
          setEnviandoAudio(false);
          setTempoGravacao(0);
        }
        resolve();
      };
      rec.stop();
    });
  }, [instanciaId, telefone, userId, replyToWaId, conteudoCitado, onSent, toast]);

  const transcreverGravacao = useCallback(async (): Promise<string | null> => {
    const rec = mediaRecorderRef.current;
    if (!rec) return null;
    return new Promise<string | null>((resolve) => {
      rec.onstop = async () => {
        rec.stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setGravando(false);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        chunksRef.current = [];
        if (blob.size === 0) { setTempoGravacao(0); resolve(null); return; }
        setTranscrevendo(true);
        try {
          const buf = await blob.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let bin = '';
          const chunk = 0x8000;
          for (let i = 0; i < bytes.length; i += chunk) {
            bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
          }
          const base64 = btoa(bin);
          const fmt = rec.mimeType.includes('ogg') ? 'ogg' : 'webm';
          const { data, error } = await supabase.functions.invoke('transcribe-audio', {
            body: { audio: base64, format: fmt },
          });
          if (error) throw error;
          const texto = (data?.text || '').trim();
          if (!texto) {
            toast({ title: 'Transcrição vazia', description: 'Não foi possível entender o áudio. Tente novamente.', variant: 'destructive' });
            resolve(null);
            return;
          }
          resolve(texto);
        } catch (err: any) {
          toast({ title: 'Erro ao transcrever', description: err.message || 'Falha desconhecida', variant: 'destructive' });
          resolve(null);
        } finally {
          setTranscrevendo(false);
          setTempoGravacao(0);
        }
      };
      rec.stop();
    });
  }, [toast]);

  const formatTempo = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return {
    gravando, tempoGravacao, enviandoAudio, transcrevendo,
    iniciarGravacao, cancelarGravacao, enviarGravacao, transcreverGravacao, formatTempo,
  };
}
