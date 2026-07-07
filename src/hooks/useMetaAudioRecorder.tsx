import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseMetaAudioRecorderProps {
  instanciaId: string;
  telefone: string;
  userId?: string;
  replyToWaId?: string;
  conteudoCitado?: string;
  onSent: () => void;
}

// Lazy-loaded ffmpeg.wasm instance — used to remux non-OGG audio into OGG/OPUS
// (the container the Meta Cloud API accepts most reliably).
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
    });
    return ffmpeg;
  })();
  return _ffmpegPromise;
}

async function ensureMetaAudio(
  blob: Blob,
  mimeType: string,
): Promise<{ blob: Blob; ext: 'ogg' | 'mp4' | 'm4a'; contentType: string }> {
  // Fast path: OGG/OPUS already — ship as-is.
  if (mimeType.includes('ogg')) {
    return { blob, ext: 'ogg', contentType: 'audio/ogg' };
  }
  // Fast path: MP4/AAC (Safari default) — Meta accepts audio/mp4, no wasm needed.
  if (mimeType.includes('mp4') || mimeType.includes('m4a') || mimeType.includes('aac')) {
    return { blob, ext: 'm4a', contentType: 'audio/mp4' };
  }
  // Otherwise (webm/opus on Chrome/Edge/Firefox) → remux to OGG/OPUS via ffmpeg.wasm.
  const ffmpeg = await getFFmpeg();
  const inExt = mimeType.includes('webm') ? 'webm' : 'bin';
  const inName = `in.${inExt}`;
  const outName = 'out.ogg';
  const buf = new Uint8Array(await blob.arrayBuffer());
  await ffmpeg.writeFile(inName, buf);
  const args = mimeType.includes('webm')
    ? ['-i', inName, '-c:a', 'copy', '-vn', outName]
    : ['-i', inName, '-c:a', 'libopus', '-b:a', '32k', '-vn', outName];
  await ffmpeg.exec(args);
  const data = await ffmpeg.readFile(outName);
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
      // Ordem preferida: OGG/OPUS (aceito nativo pela Meta). Se o navegador não
      // suportar (Safari/iOS ou Chrome sem mux OGG), caímos para webm/mp4/aac e
      // o áudio é remuxado para OGG/OPUS via ffmpeg.wasm antes do envio.
      const candidatos = [
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/aac',
      ];
      const mimeType = candidatos.find(m => MediaRecorder.isTypeSupported(m));
      if (!mimeType) {
        stream.getTracks().forEach(t => t.stop());
        toast({
          title: 'Navegador não suporta gravação de áudio',
          description: 'Atualize seu Chrome/Edge/Safari e tente novamente.',
          variant: 'destructive',
        });
        return;
      }
      const rec = new MediaRecorder(stream, { mimeType });
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
          let prepared: { blob: Blob; ext: 'ogg' | 'mp4' | 'm4a'; contentType: string };
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
          const { error: upErr } = await supabase.storage.from('inbox-media')
            .upload(path, prepared.blob, { contentType: prepared.contentType });
          if (upErr) throw upErr;
          const { data: urlData } = supabase.storage.from('inbox-media').getPublicUrl(path);
          const { data, error } = await supabase.functions.invoke('send-whatsapp-meta-media', {
            body: {
              instancia_id: instanciaId,
              telefone,
              media_url: urlData.publicUrl,
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
