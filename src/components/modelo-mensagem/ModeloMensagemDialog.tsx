import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ColarImagemTab } from '@/components/modelo-mensagem/ColarImagemTab';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModeloMensagemDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modelo Mensagem</DialogTitle>
          <DialogDescription>
            Cole o print do Cob+, confira os dados e copie a mensagem de negociação.
          </DialogDescription>
        </DialogHeader>
        {open && <ColarImagemTab />}
      </DialogContent>
    </Dialog>
  );
}
