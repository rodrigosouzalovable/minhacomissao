import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { FileText, Image as ImageIcon, Loader2, X, Trash2, Ban, Pencil, Reply, CornerUpLeft, Check, CheckCheck, Clock3, AlertCircle, Copy, ExternalLink, Phone, MessageSquare, User } from 'lucide-react';
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
import { ensureInboxMediaUrl } from '@/lib/inboxMediaUrl';
import { extrairPix } from '@/lib/pixCode';

interface ContatoCompartilhadoTelefone {
  numero: string;
  formatado?: string | null;
  wa_id?: string | null;
}

interface ContatoCompartilhado {
  nome: string;
  telefones?: ContatoCompartilhadoTelefone[] | null;
}

interface TemplateBotao {
  type: string;
  text: string;
  url?: string;
  phone_number?: string;
}


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
  template_botoes?: TemplateBotao[] | null;
  contatos_payload?: ContatoCompartilhado[] | null;
}

interface ChatMessageProps {
  msg: Mensagem;
  formatMsgTime: (ts: string) => string;
  onApagarParaMim?: (msgId: string) => void;
  onApagarParaTodos?: (msgId: string) => void;
  onEditar?: (msgId: string, conteudoAtual: string) => void;
  onResponder?: (msg: Mensagem) => void;
  /** Se true, exibe indicador âmbar de "aceita pela Meta mas não entregue ao aparelho". */
  possivelmenteNaoEntregue?: boolean;
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

export function ChatMessage({ msg, formatMsgTime, onApagarParaMim, onApagarParaTodos, onEditar, onResponder, possivelmenteNaoEntregue }: ChatMessageProps) {
  const tipo = msg.tipo_conteudo || 'texto';
  const isSaida = msg.direcao === 'saida';
  const isTemp = msg.id.startsWith('temp-');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [showLightbox, setShowLightbox] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<'mim' | 'todos' | null>(null);
  // Bucket de mídia é privado: reassina URLs antigas/expiradas antes de exibir.
  const [mediaUrl, setMediaUrl] = useState<string | null>(msg.media_url ?? null);
  useEffect(() => {
    let cancelled = false;
    setMediaUrl(msg.media_url ?? null);
    if (!msg.media_url) return;
    ensureInboxMediaUrl(msg.media_url).then((u) => { if (!cancelled && u) setMediaUrl(u); });
    return () => { cancelled = true; };
  }, [msg.media_url]);
  const lightboxImageSrc = blobUrl || mediaUrl;

  const closeLightbox = useCallback(() => setShowLightbox(false), []);

  useEffect(() => {
    if (!showLightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeLightbox(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showLightbox, closeLightbox]);

  useEffect(() => {
    if (tipo !== 'imagem' || !mediaUrl) return;
    let cancelled = false;
    setImgLoading(true);
    setImgError(false);

    fetch(mediaUrl)
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

        const mime = getImageMimeFromUrl(mediaUrl!);
        const correctedBlob = blob.type && blob.type !== 'application/octet-stream'
          ? blob
          : new Blob([blob], { type: mime });
        setBlobUrl(URL.createObjectURL(correctedBlob));
      })
      .catch(() => { if (!cancelled) setImgError(true); })
      .finally(() => { if (!cancelled) setImgLoading(false); });

    return () => { cancelled = true; };
  }, [tipo, mediaUrl]);

  useEffect(() => {
    if (tipo !== 'audio' || !mediaUrl) return;
    let cancelled = false;

    fetch(mediaUrl)
      .then(r => {
        if (!r.ok) throw new Error('fetch failed');
        return r.blob();
      })
      .then(blob => {
        if (cancelled) return;
        const mime = getMimeFromUrl(mediaUrl!) || 'audio/ogg';
        const correctedBlob = blob.type && blob.type !== 'application/octet-stream'
          ? blob
          : new Blob([blob], { type: mime });
        setAudioBlobUrl(URL.createObjectURL(correctedBlob));
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [tipo, mediaUrl]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl);
    };
  }, [blobUrl, audioBlobUrl]);

  const renderContent = () => {
    if (tipo !== 'texto' && !mediaUrl && msg.conteudo?.includes('Acesse seu WhatsApp')) {
      return <p className="text-xs italic text-muted-foreground">{msg.conteudo}</p>;
    }

    if (tipo !== 'texto' && !mediaUrl) {
      return <p className="text-xs italic text-muted-foreground">Mídia indisponível</p>;
    }

    if (tipo === 'audio' && mediaUrl) {
      const src = audioBlobUrl || mediaUrl;
      const mimeType = getMimeFromUrl(mediaUrl);
      return (
        <WhatsAppAudioPlayer
          src={src}
          isSaida={isSaida}
          messageId={msg.id}
          mimeType={mimeType}
        />
      );
    }

    // Botão "Copiar código Pix" quando a mensagem contém um payload Pix Copia e Cola
    const renderPix = () => {
      const codigo = extrairPix(msg.conteudo);
      if (!codigo) return null;
      return (
        <div className="mt-2 pt-1.5 border-t border-border/40">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(codigo);
              toast({ title: 'Código Pix copiado' });
            }}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded hover:bg-background/60 transition"
          >
            <Copy className="h-3.5 w-3.5" /> Copiar código Pix
          </button>
        </div>
      );
    };

    // Renderiza a lista de botões do template (URL / QUICK_REPLY / PHONE_NUMBER)
    const renderBotoes = () => {
      const botoes = msg.template_botoes;
      if (!Array.isArray(botoes) || botoes.length === 0) return null;
      return (
        <div className="mt-2 pt-2 border-t border-border/30 flex flex-col gap-1">
          {botoes.map((b, i) => {
            const t = String(b.type || '').toUpperCase();
            const Icon = t === 'URL' ? ExternalLink : t === 'PHONE_NUMBER' ? Phone : MessageSquare;
            const label = b.text || (t === 'URL' ? b.url : t === 'PHONE_NUMBER' ? b.phone_number : 'Resposta');
            const content = (
              <span className="flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium text-primary hover:bg-primary/5 transition rounded">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </span>
            );
            if (t === 'URL' && b.url) {
              return (
                <a key={i} href={b.url} target="_blank" rel="noopener noreferrer" className="block rounded border border-border/40 bg-background/40">
                  {content}
                </a>
              );
            }
            if (t === 'PHONE_NUMBER' && b.phone_number) {
              return (
                <a key={i} href={`tel:${b.phone_number}`} className="block rounded border border-border/40 bg-background/40">
                  {content}
                </a>
              );
            }
            return (
              <div key={i} className="block rounded border border-border/40 bg-background/40">
                {content}
              </div>
            );
          })}
        </div>
      );
    };

    if (tipo === 'imagem' && mediaUrl) {
      const imgNode = imgLoading ? (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (imgError || !blobUrl) ? (
        <a href={mediaUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 p-3 rounded bg-background/30 hover:bg-background/50 transition">
          <ImageIcon className="h-5 w-5 shrink-0" />
          <span className="text-xs underline">Abrir imagem</span>
        </a>
      ) : (
        <div className="cursor-zoom-in" onClick={() => setShowLightbox(true)}>
          <img
            src={blobUrl}
            alt="Imagem"
            className="max-w-[250px] rounded-md hover:opacity-90 transition"
            onError={() => setImgError(true)}
          />
        </div>
      );
      return (
        <div className="flex flex-col gap-2">
          {imgNode}
          {msg.conteudo && (
            <p className="whitespace-pre-wrap break-words select-text cursor-text text-sm">
              {msg.conteudo}
            </p>
          )}
          {renderPix()}
          {renderBotoes()}
        </div>
      );
    }

    if (tipo === 'documento' && mediaUrl) {
      return (
        <div className="flex flex-col gap-2">
          <a
            href={mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 rounded bg-background/30 hover:bg-background/50 transition"
          >
            <FileText className="h-5 w-5 shrink-0" />
            <span className="text-xs underline truncate">{msg.conteudo || 'Documento'}</span>
          </a>
          {renderBotoes()}
        </div>
      );
    }

    if (tipo === 'contato') {
      const contatos = Array.isArray(msg.contatos_payload) ? msg.contatos_payload : [];
      if (!contatos.length) {
        return (
          <div className="flex items-center gap-2 p-2 rounded bg-background/30">
            <User className="h-5 w-5 shrink-0" />
            <span className="text-sm">{msg.conteudo || 'Contato compartilhado'}</span>
          </div>
        );
      }
      return (
        <div className="flex flex-col gap-2 min-w-[210px]">
          {contatos.map((c, i) => {
            const tel = c.telefones?.[0];
            const digits = String(tel?.numero || '').replace(/\D/g, '');
            const waDigits = digits ? (digits.startsWith('55') ? digits : `55${digits}`) : '';
            return (
              <div key={i} className="flex flex-col gap-2 p-2 rounded-lg bg-background/40">
                <div className="flex items-center gap-2">
                  <span className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.nome || 'Contato'}</p>
                    {tel && (
                      <p className="text-xs opacity-80 truncate">{tel.formatado || tel.numero}</p>
                    )}
                    {(c.telefones?.length || 0) > 1 && (
                      <p className="text-[10px] opacity-70">
                        +{(c.telefones?.length || 0) - 1} outro(s) número(s)
                      </p>
                    )}
                  </div>
                </div>
                {digits && (
                  <div className="flex items-center gap-1 border-t border-border/40 pt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(tel?.formatado || digits);
                        toast({ title: 'Número copiado' });
                      }}
                      className="flex-1 text-[11px] font-medium py-1 rounded hover:bg-background/60 transition flex items-center justify-center gap-1"
                    >
                      <Copy className="h-3 w-3" /> Copiar
                    </button>
                    <a
                      href={`https://wa.me/${waDigits}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-[11px] font-medium py-1 rounded hover:bg-background/60 transition flex items-center justify-center gap-1"
                    >
                      <MessageSquare className="h-3 w-3" /> Conversar
                    </a>
                  </div>
                )}
              </div>
            );
          })}
          {renderBotoes()}
        </div>
      );
    }



    return (
      <div className="flex flex-col">
        <p className="whitespace-pre-wrap break-words select-text cursor-text">{msg.conteudo}</p>
        {renderPix()}
        {renderBotoes()}
      </div>
    );
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
            if (possivelmenteNaoEntregue) {
              return (
                <AlertCircle
                  className="h-3.5 w-3.5 text-amber-300"
                  aria-label="Aceita pela Meta mas ainda não entregue ao aparelho do cliente"
                />
              );
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
