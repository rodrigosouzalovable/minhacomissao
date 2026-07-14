import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Loader2, Send, X } from 'lucide-react';

interface Props {
  file: File | null;
  destinoLabel: string;
  enviando: boolean;
  onConfirmar: (file: File, caption: string) => void;
  onCancelar: () => void;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ConfirmarEnvioArquivoDialog({ file, destinoLabel, enviando, onConfirmar, onCancelar }: Props) {
  const [caption, setCaption] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setCaption('');
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [file]);

  const isImage = !!file && file.type.startsWith('image/');
  const isPdf = !!file && file.type === 'application/pdf';

  return (
    <Dialog open={!!file} onOpenChange={(o) => { if (!o && !enviando) onCancelar(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar envio de arquivo</DialogTitle>
          <DialogDescription>
            Revise o arquivo antes de enviar. Nada será enviado até você clicar em <strong>Enviar</strong>.
          </DialogDescription>
        </DialogHeader>

        {file && (
          <div className="space-y-3">
            <div className="rounded-md border p-3 bg-muted/30">
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Destinatário</div>
              <div className="text-sm font-semibold truncate">{destinoLabel}</div>
            </div>

            <div className="rounded-md border overflow-hidden">
              {isImage && previewUrl ? (
                <img src={previewUrl} alt={file.name} className="w-full max-h-64 object-contain bg-black/5" />
              ) : (
                <div className="flex items-center gap-3 p-4">
                  <FileText className="h-10 w-10 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {isPdf ? 'PDF' : file.type || 'Arquivo'} · {formatSize(file.size)}
                    </div>
                  </div>
                </div>
              )}
              {isImage && (
                <div className="px-3 py-2 border-t text-xs text-muted-foreground truncate">
                  {file.name} · {formatSize(file.size)}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Legenda (opcional)</label>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Adicione uma legenda para acompanhar o arquivo..."
                rows={2}
                disabled={enviando}
                className="resize-none"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onCancelar} disabled={enviando}>
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
          <Button
            onClick={() => file && onConfirmar(file, caption.trim())}
            disabled={!file || enviando}
          >
            {enviando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
