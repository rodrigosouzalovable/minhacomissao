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
      // Meta Cloud API aceita: audio/ogg (OPUS), audio/aac, audio/mp4, audio/mpeg, audio/amr.
      // NÃO aceita audio/webm. Priorizamos ogg → mp4 (Safari/iOS).
      const candidatos = [
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/aac',
      ];
      const mimeType = candidatos.find(m => MediaRecorder.isTypeSupported(m));
      if (!mimeType) {
        stream.getTracks().forEach(t => t.stop());
        toast({
          title: 'Navegador não suporta áudio compatível com WhatsApp',
          description: 'Use um Chrome/Edge atualizado, ou Safari no iOS. O áudio em WebM não é aceito pela Meta.',
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
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        chunksRef.current = [];
        if (blob.size === 0) { setTempoGravacao(0); resolve(); return; }
        setEnviandoAudio(true);
        try {
          const mt = rec.mimeType || 'audio/ogg';
          const ext = mt.includes('ogg') ? 'ogg'
            : mt.includes('mp4') || mt.includes('m4a') ? 'm4a'
            : mt.includes('aac') ? 'aac'
            : 'ogg';
          const uploadType = mt.includes('ogg') ? 'audio/ogg'
            : mt.includes('mp4') || mt.includes('m4a') ? 'audio/mp4'
            : mt.includes('aac') ? 'audio/aac'
            : 'audio/ogg';
          const path = `meta/${instanciaId}/${telefone}/${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage.from('inbox-media')
            .upload(path, blob, { contentType: uploadType });
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
