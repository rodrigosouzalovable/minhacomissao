import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { FileText, Image as ImageIcon, Loader2 } from 'lucide-react';

interface Mensagem {
  id: string;
  conteudo: string;
  direcao: string;
  timestamp_msg: string;
  tipo_conteudo?: string;
  media_url?: string | null;
}

interface ChatMessageProps {
  msg: Mensagem;
  formatMsgTime: (ts: string) => string;
}

function getMimeFromUrl(url: string): string | undefined {
  const ext = url.split('.').pop()?.split('?')[0]?.toLowerCase();
  const map: Record<string, string> = {
    ogg: 'audio/ogg',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    wav: 'audio/wav',
    webm: 'audio/webm',
  };
  return ext ? map[ext] : undefined;
}

function getImageMimeFromUrl(url: string): string {
  const ext = url.split('.').pop()?.split('?')[0]?.toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  };
  return (ext && map[ext]) || 'image/jpeg';
}

export function ChatMessage({ msg, formatMsgTime }: ChatMessageProps) {
  const tipo = msg.tipo_conteudo || 'texto';
  const isSaida = msg.direcao === 'saida';
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);

  // For images: fetch as blob to bypass wrong Content-Type from storage
  useEffect(() => {
    if (tipo !== 'imagem' || !msg.media_url) return;
    let cancelled = false;
    setImgLoading(true);
    setImgError(false);

    fetch(msg.media_url)
      .then(r => {
        if (!r.ok) throw new Error('fetch failed');
        return r.blob();
      })
      .then(async (blob) => {
        if (cancelled) return;
        // Validate the blob is actually image data by checking magic bytes
        const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
        const isJpeg = header[0] === 0xFF && header[1] === 0xD8;
        const isPng = header[0] === 0x89 && header[1] === 0x50;
        const isWebp = header[0] === 0x52 && header[1] === 0x49; // RIFF
        const isGif = header[0] === 0x47 && header[1] === 0x49; // GIF

        if (!isJpeg && !isPng && !isWebp && !isGif) {
          console.warn('[ChatMessage] Blob is not valid image data, showing fallback');
          setImgError(true);
          return;
        }

        const mime = getImageMimeFromUrl(msg.media_url!);
        const correctedBlob = blob.type && blob.type !== 'application/octet-stream'
          ? blob
          : new Blob([blob], { type: mime });
        setBlobUrl(URL.createObjectURL(correctedBlob));
      })
      .catch(() => { if (!cancelled) setImgError(true); })
      .finally(() => { if (!cancelled) setImgLoading(false); });

    return () => { cancelled = true; };
  }, [tipo, msg.media_url]);

  // For audio: fetch as blob to bypass wrong Content-Type
  useEffect(() => {
    if (tipo !== 'audio' || !msg.media_url) return;
    let cancelled = false;

    fetch(msg.media_url)
      .then(r => {
        if (!r.ok) throw new Error('fetch failed');
        return r.blob();
      })
      .then(blob => {
        if (cancelled) return;
        const mime = getMimeFromUrl(msg.media_url!) || 'audio/ogg';
        const correctedBlob = blob.type && blob.type !== 'application/octet-stream'
          ? blob
          : new Blob([blob], { type: mime });
        setAudioBlobUrl(URL.createObjectURL(correctedBlob));
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [tipo, msg.media_url]);

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl);
    };
  }, [blobUrl, audioBlobUrl]);

  const renderContent = () => {
    // Media expired
    if (tipo !== 'texto' && !msg.media_url && msg.conteudo?.includes('Acesse seu WhatsApp')) {
      return (
        <p className="text-xs italic text-muted-foreground">{msg.conteudo}</p>
      );
    }

    // Media without URL (encrypted/unavailable)
    if (tipo !== 'texto' && !msg.media_url) {
      return (
        <p className="text-xs italic text-muted-foreground">
          Mídia indisponível
        </p>
      );
    }

    if (tipo === 'audio' && msg.media_url) {
      const src = audioBlobUrl || msg.media_url;
      const mimeType = getMimeFromUrl(msg.media_url);
      return (
        <audio controls className="max-w-full" preload="none">
          <source src={src} type={mimeType} />
          Seu navegador não suporta áudio.
        </audio>
      );
    }

    if (tipo === 'imagem' && msg.media_url) {
      if (imgLoading) {
        return (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        );
      }
      if (imgError || !blobUrl) {
        return (
          <a href={msg.media_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 rounded bg-background/30 hover:bg-background/50 transition">
            <ImageIcon className="h-5 w-5 shrink-0" />
            <span className="text-xs underline">Abrir imagem</span>
          </a>
        );
      }
      return (
        <a href={blobUrl} target="_blank" rel="noopener noreferrer">
          <img
            src={blobUrl}
            alt="Imagem"
            className="max-w-[250px] rounded-md cursor-pointer hover:opacity-90 transition"
            onError={() => setImgError(true)}
          />
        </a>
      );
    }

    if (tipo === 'documento' && msg.media_url) {
      return (
        <a
          href={msg.media_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-2 rounded bg-background/30 hover:bg-background/50 transition"
        >
          <FileText className="h-5 w-5 shrink-0" />
          <span className="text-xs underline truncate">{msg.conteudo || 'Documento'}</span>
        </a>
      );
    }

    return <p className="whitespace-pre-wrap break-words">{msg.conteudo}</p>;
  };

  return (
    <div className={cn("flex", isSaida ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm",
          isSaida
            ? "bg-primary text-primary-foreground rounded-br-none"
            : "bg-card text-card-foreground border border-border rounded-bl-none"
        )}
      >
        {renderContent()}
        <p className={cn(
          "text-[10px] mt-1 text-right",
          isSaida ? "text-primary-foreground/70" : "text-muted-foreground"
        )}>
          {formatMsgTime(msg.timestamp_msg)}
        </p>
      </div>
    </div>
  );
}
