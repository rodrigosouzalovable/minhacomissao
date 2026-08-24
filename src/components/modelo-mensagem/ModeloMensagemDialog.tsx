import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ColarImagemTab } from '@/components/modelo-mensagem/ColarImagemTab';
import { LayoutUmeTab } from '@/components/modelo-mensagem/LayoutUmeTab';
import { CREDOR_MARCAS } from '@/lib/credorMarcas';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credor?: string | null;
}

function abaDoCredor(credor?: string | null) {
  return credor === 'ume' ? 'layout-ume' : 'imagem';
}

export function ModeloMensagemDialog({ open, onOpenChange, credor }: Props) {
  const [aba, setAba] = useState(() => abaDoCredor(credor));

  useEffect(() => {
    if (open) setAba(abaDoCredor(credor));
  }, [open, credor]);

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
          <Tabs value={aba} onValueChange={setAba}>
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
