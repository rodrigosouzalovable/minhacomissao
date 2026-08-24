import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ColarImagemTab } from '@/components/modelo-mensagem/ColarImagemTab';
import { LayoutUmeTab } from '@/components/modelo-mensagem/LayoutUmeTab';

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
            Cole o print, confira os dados e copie a mensagem de negociação.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <Tabs defaultValue="imagem">
            <TabsList>
              <TabsTrigger value="imagem">Layout Novo Mundo</TabsTrigger>
              <TabsTrigger value="layout-ume">Layout UME</TabsTrigger>
            </TabsList>
            <TabsContent value="imagem" className="mt-4">
              <ColarImagemTab />
            </TabsContent>
            <TabsContent value="layout-ume" className="mt-4">
              <LayoutUmeTab />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
