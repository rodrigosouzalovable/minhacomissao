import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Mic, Paperclip, X, Square, Loader2 } from 'lucide-react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ChatInputBarProps {
  instanciaId: string;
  telefone: string;
  serverUrl: string;
  instanceToken: string;
  onTextSent: (texto: string) => Promise<void>;
  onMediaSent: () => void;
  enviando: boolean;
}

export function ChatInputBar({
  instanciaId, telefone, serverUrl, instanceToken,
  onTextSent, onMediaSent, enviando,
}: ChatInputBarProps) {
  const { toast } = useToast();
  const [textoMensagem, setTextoMensagem] = useState('');
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    gravando, tempoGravacao, enviandoAudio,
    iniciarGravacao, cancelarGravacao, enviarGravacao, formatTempo,
  } = useAudioRecorder({
    instanciaId, telefone, serverUrl, instanceToken,
    onSent: onMediaSent,
  });

  const handleEnviarTexto = async () => {
    if (!textoMensagem.trim() || enviando) return;
    const texto = textoMensagem.trim();
    setTextoMensagem('');
    await onTextSent(texto);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    if (!isImage && !isPdf) {
      toast({ title: 'Arquivo inválido', description: 'Envie apenas imagens ou PDFs', variant: 'destructive' });
      return;
    }

    setEnviandoArquivo(true);
    try {
      const ext = file.name.split('.').pop() || (isImage ? 'jpg' : 'pdf');
      const fileName = `${instanciaId}/${telefone}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('inbox-media')
        .upload(fileName, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('inbox-media')
        .getPublicUrl(fileName);

      const { data, error } = await supabase.functions.invoke('send-whatsapp-media', {
        body: {
          telefone,
          media_url: urlData.publicUrl,
          type: isImage ? 'image' : 'document',
          uazapi_server_url: serverUrl,
          uazapi_instance_token: instanceToken,
          instancia_id: instanciaId,
          file_name: file.name,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha ao enviar');
      onMediaSent();
    } catch (err: any) {
      toast({ title: 'Erro ao enviar arquivo', description: err.message, variant: 'destructive' });
    } finally {
      setEnviandoArquivo(false);
    }
  };

  const isLoading = enviando || enviandoAudio || enviandoArquivo;

  if (gravando) {
    return (
      <div className="p-3 border-t border-border bg-card flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={cancelarGravacao}>
          <X className="h-4 w-4 text-destructive" />
        </Button>
        <div className="flex-1 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-sm text-destructive font-medium">Gravando {formatTempo(tempoGravacao)}</span>
        </div>
        <Button size="icon" onClick={enviarGravacao} disabled={enviandoAudio}>
          {enviandoAudio ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    );
  }

  return (
    <div className="p-3 border-t border-border bg-card flex gap-2">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*,.pdf"
        onChange={handleFileChange}
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading}
        className="shrink-0"
      >
        {enviandoArquivo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
      </Button>
      <Input
        placeholder="Digite uma mensagem..."
        value={textoMensagem}
        onChange={e => setTextoMensagem(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleEnviarTexto();
          }
        }}
        disabled={isLoading}
        className="flex-1"
      />
      {textoMensagem.trim() ? (
        <Button onClick={handleEnviarTexto} disabled={isLoading} size="icon" className="shrink-0">
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={iniciarGravacao}
          disabled={isLoading}
          className="shrink-0"
        >
          <Mic className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
