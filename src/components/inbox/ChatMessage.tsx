import { cn } from '@/lib/utils';
import { FileText, Image as ImageIcon } from 'lucide-react';

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

export function ChatMessage({ msg, formatMsgTime }: ChatMessageProps) {
  const tipo = msg.tipo_conteudo || 'texto';
  const isSaida = msg.direcao === 'saida';

  const renderContent = () => {
    // Media expired
    if (tipo !== 'texto' && !msg.media_url && msg.conteudo?.includes('Acesse seu WhatsApp')) {
      return (
        <p className="text-xs italic text-muted-foreground">{msg.conteudo}</p>
      );
    }

    if (tipo === 'audio' && msg.media_url) {
      return (
        <audio controls className="max-w-full" preload="none">
          <source src={msg.media_url} />
          Seu navegador não suporta áudio.
        </audio>
      );
    }

    if (tipo === 'imagem' && msg.media_url) {
      return (
        <a href={msg.media_url} target="_blank" rel="noopener noreferrer">
          <img
            src={msg.media_url}
            alt="Imagem"
            className="max-w-[250px] rounded-md cursor-pointer hover:opacity-90 transition"
            loading="lazy"
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
