import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PhoneCall } from 'lucide-react';

interface Props {
  open: boolean;
  clienteNome: string;
  telefone: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmarTelefoneDialog({ open, clienteNome, telefone, onCancel, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PhoneCall className="h-5 w-5" /> Confirme o telefone do cliente</DialogTitle>
          <DialogDescription>
            Confirme somente se você realmente falou com {clienteNome || 'o cliente'} neste número.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border bg-muted/40 p-4 text-center text-xl font-semibold">{telefone}</div>
        <DialogFooter className="gap-2 sm:space-x-0">
          <Button type="button" variant="outline" onClick={onCancel}>Voltar e corrigir</Button>
          <Button type="button" onClick={onConfirm}>Confirmo que falei neste telefone</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}