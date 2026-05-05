import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { FileText, Image as ImageIcon, Loader2, X, Trash2, Ban, Pencil, Reply, CornerUpLeft, Check, CheckCheck, Clock3, AlertCircle, Copy } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { createPortal } from 'react-dom';
import { WhatsAppAudioPlayer } from './WhatsAppAudioPlayer';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Mensagem {
  id: string;
  conteudo: string;
  direcao: string;
  timestamp_msg: string;
  tipo_conteudo?: string;
  media_url?: string | null;
  whatsapp_msg_id?: string | null;
  quoted_msg_id?: string | null;
  quoted_conteudo?: string | null;
  quoted_direcao?: string | null;
  status_envio?: string | null;
}

interface ChatMessageProps {
  msg: Mensagem;
  formatMsgTime: (ts: string) => string;
  onApagarParaMim?: (msgId: string) => void;
  onApagarParaTodos?: (msgId: string) => void;
  onEditar?: (msgId: string, conteudoAtual: string) => void;
  onResponder?: (msg: Mensagem) => void;
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

export function ChatMessage({ msg, formatMsgTime, onApagarParaMim, onApagarParaTodos, onEditar, onResponder }: ChatMessageProps) {
  const tipo = msg.tipo_conteudo || 'texto';
  const isSaida = msg.direcao === 'saida';
  const isTemp = msg.id.startsWith('temp-');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [showLightbox, setShowLightbox] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<'mim' | 'todos' | null>(null);
  const lightboxImageSrc = blobUrl || msg.media_url;

  const closeLightbox = useCallback(() => setShowLightbox(false), []);

  useEffect(() => {
    if (!showLightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeLightbox(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showLightbox, closeLightbox]);

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
        const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
        const isJpeg = header[0] === 0xFF && header[1] === 0xD8;
        const isPng = header[0] === 0x89 && header[1] === 0x50;
        const isWebp = header[0] === 0x52 && header[1] === 0x49;
        const isGif = header[0] === 0x47 && header[1] === 0x49;

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

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl);
    };
  }, [blobUrl, audioBlobUrl]);

  const renderContent = () => {
    if (tipo !== 'texto' && !msg.media_url && msg.conteudo?.includes('Acesse seu WhatsApp')) {
      return <p className="text-xs italic text-muted-foreground">{msg.conteudo}</p>;
    }

    if (tipo !== 'texto' && !msg.media_url) {
      return <p className="text-xs italic text-muted-foreground">Mídia indisponível</p>;
    }

    if (tipo === 'audio' && msg.media_url) {
      const src = audioBlobUrl || msg.media_url;
      const mimeType = getMimeFromUrl(msg.media_url);
      return (
        <WhatsAppAudioPlayer
          src={src}
          isSaida={isSaida}
          messageId={msg.id}
          mimeType={mimeType}
        />
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
        <div className="cursor-zoom-in" onClick={() => setShowLightbox(true)}>
          <img
            src={blobUrl}
            alt="Imagem"
            className="max-w-[250px] rounded-md hover:opacity-90 transition"
            onError={() => setImgError(true)}
          />
        </div>
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

    return <p className="whitespace-pre-wrap break-words select-text cursor-text">{msg.conteudo}</p>;
  };

  const handleConfirmDelete = () => {
    if (confirmDialog === 'mim' && onApagarParaMim) {
      onApagarParaMim(msg.id);
    } else if (confirmDialog === 'todos' && onApagarParaTodos) {
      onApagarParaTodos(msg.id);
    }
    setConfirmDialog(null);
  };

  // Swipe-to-reply (igual ao WhatsApp Web)
  const swipeRef = useRef<HTMLDivElement>(null);
  const swipeState = useRef<{ startX: number; active: boolean; pointerId: number | null }>({
    startX: 0,
    active: false,
    pointerId: null,
  });
  const [swipeDx, setSwipeDx] = useState(0);
  const SWIPE_TRIGGER = 60;
  const SWIPE_MAX = 110;

  const triggerReply = useCallback(() => {
    if (onResponder && !isTemp) onResponder(msg);
  }, [onResponder, isTemp, msg]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onResponder || isTemp) return;
    // No desktop (mouse), não interceptamos o gesto para permitir seleção de texto.
    // Swipe-to-reply continua disponível em touch/pen (mobile).
    if (e.pointerType === 'mouse') return;
    swipeState.current = { startX: e.clientX, active: true, pointerId: e.pointerId };
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!swipeState.current.active) return;
    let dx = e.clientX - swipeState.current.startX;
    // Permite arrastar para a direção "natural" do reply do WhatsApp:
    // - mensagens recebidas (esquerda): arrastar para a direita (dx > 0)
    // - mensagens enviadas (direita): arrastar para a esquerda (dx < 0)
    if (isSaida) dx = Math.min(0, Math.max(-SWIPE_MAX, dx));
    else dx = Math.max(0, Math.min(SWIPE_MAX, dx));
    setSwipeDx(dx);
  };
  const endSwipe = () => {
    if (!swipeState.current.active) return;
    const dx = swipeDx;
    swipeState.current.active = false;
    swipeState.current.pointerId = null;
    if (Math.abs(dx) >= SWIPE_TRIGGER) {
      triggerReply();
    }
    setSwipeDx(0);
  };

  const swipeProgress = Math.min(1, Math.abs(swipeDx) / SWIPE_TRIGGER);
  const showSwipeIcon = Math.abs(swipeDx) > 8;

  const renderQuoted = () => {
    if (!msg.quoted_conteudo) return null;
    const quotedIsSaida = msg.quoted_direcao === 'saida';
    return (
      <div
        className={cn(
          'mb-1.5 px-2 py-1 rounded border-l-4 text-xs overflow-hidden',
          isSaida
            ? 'bg-primary-foreground/10 border-primary-foreground/60'
            : 'bg-muted border-primary',
        )}
      >
        <p className={cn('font-medium text-[10px] mb-0.5', isSaida ? 'text-primary-foreground/80' : 'text-primary')}>
          {quotedIsSaida ? 'Você' : 'Contato'}
        </p>
        <p className={cn('truncate opacity-80', isSaida ? 'text-primary-foreground' : 'text-foreground')}>
          {msg.quoted_conteudo}
        </p>
      </div>
    );
  };

  const messageBubble = (
    <div
      ref={swipeRef}
      className={cn('relative flex', isSaida ? 'justify-end' : 'justify-start')}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endSwipe}
      onPointerCancel={endSwipe}
      onDoubleClick={triggerReply}
      style={{ touchAction: 'pan-y' }}
    >
      {showSwipeIcon && (
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 flex items-center justify-center h-9 w-9 rounded-full bg-muted text-muted-foreground transition-opacity',
            isSaida ? 'right-2' : 'left-2',
          )}
          style={{ opacity: swipeProgress }}
        >
          <CornerUpLeft className="h-4 w-4" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm overflow-hidden break-words transition-transform',
          isSaida
            ? 'bg-primary text-primary-foreground rounded-br-none'
            : 'bg-card text-card-foreground border border-border rounded-bl-none',
        )}
        style={{ transform: `translateX(${swipeDx}px)` }}
      >
        {renderQuoted()}
        {renderContent()}
        <div
          className={cn(
            'flex items-center gap-1 mt-1 justify-end',
          )}
        >
          <p
            className={cn(
              'text-[10px]',
              isSaida ? 'text-primary-foreground/70' : 'text-muted-foreground',
            )}
          >
            {formatMsgTime(msg.timestamp_msg)}
          </p>
          {isSaida && (() => {
            const status = msg.status_envio || (isTemp ? 'enviando' : 'enviada');
            if (status === 'erro') {
              return <AlertCircle className="h-3 w-3 text-red-400" aria-label="Erro ao enviar" />;
            }
            if (status === 'enviando') {
              return <Clock3 className="h-3 w-3 text-primary-foreground/70" aria-label="Enviando" />;
            }
            if (status === 'lida') {
              return <CheckCheck className="h-3.5 w-3.5 text-sky-300" aria-label="Lida" />;
            }
            if (status === 'entregue') {
              return <CheckCheck className="h-3.5 w-3.5 text-primary-foreground/70" aria-label="Entregue" />;
            }
            return <Check className="h-3.5 w-3.5 text-primary-foreground/70" aria-label="Enviada" />;
          })()}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {isTemp ? (
        messageBubble
      ) : (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            {messageBubble}
          </ContextMenuTrigger>
          <ContextMenuContent className="w-52">
            {onResponder && (
              <>
                <ContextMenuItem onClick={triggerReply}>
                  <Reply className="h-4 w-4 mr-2" />
                  Responder
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            )}
            {msg.conteudo && (
              <>
                <ContextMenuItem
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(msg.conteudo);
                      toast({ title: 'Copiado', description: 'Mensagem copiada para a área de transferência.' });
                    } catch {
                      toast({ title: 'Erro ao copiar', variant: 'destructive' });
                    }
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            )}
            {isSaida && tipo === 'texto' && onEditar && (
              <>
                <ContextMenuItem
                  onClick={() => onEditar(msg.id, msg.conteudo)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            )}
            <ContextMenuItem
              onClick={() => setConfirmDialog('mim')}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Apagar pra mim
            </ContextMenuItem>
            {isSaida && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() => setConfirmDialog('todos')}
                  className="text-destructive focus:text-destructive"
                >
                  <Ban className="h-4 w-4 mr-2" />
                  Apagar para todos
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
        </ContextMenu>
      )}

      <AlertDialog open={confirmDialog !== null} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog === 'todos' ? 'Apagar para todos?' : 'Apagar pra mim?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog === 'todos'
                ? 'Esta mensagem será removida do sistema. Esta ação não pode ser desfeita.'
                : 'Esta mensagem será removida apenas para você. Esta ação não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className={confirmDialog === 'todos' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}>
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showLightbox && lightboxImageSrc && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-black/90 animate-in fade-in-0 duration-200"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-10 text-white/80 hover:text-white transition p-2 rounded-full bg-white/10 hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </button>
          <div className="flex h-full w-full items-center justify-center p-4 sm:p-6 md:p-10">
            <img
              src={lightboxImageSrc}
              alt="Imagem ampliada"
              className="h-full w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
