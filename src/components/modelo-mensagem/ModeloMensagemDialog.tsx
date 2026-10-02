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
  if (credor === 'ume') return 'layout-ume';
  if (credor === 'odres_cred') return 'layout-odres-cred';
  return 'imagem';
}

export function ModeloMensagemDialog({ open, onOpenChange, credor }: Props) {
  const [aba, setAba] = useState(() => abaDoCredor(credor));

  useEffect(() => {
    if (open) setAba(abaDoCredor(credor));
  }, [open, credor]);

  const marca = aba === 'layout-ume'
    ? CREDOR_MARCAS.ume
    : aba === 'layout-odres-cred'
      ? CREDOR_MARCAS.odres_cred
      : CREDOR_MARCAS.novo_mundo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="space-y-1.5">
              <DialogTitle>Modelo Mensagem</DialogTitle>
              <DialogDescription>
                Cole o print, confira os dados e copie a mensagem de negociação.
              </DialogDescription>
            </div>
            <img
              src={marca.logo}
              alt={`Logo ${marca.nome}`}
              className="h-10 w-auto max-w-[120px] object-contain rounded-md shrink-0"
            />
          </div>
        </DialogHeader>
        {open && (
          <Tabs value={aba} onValueChange={setAba}>
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="imagem">Layout Novo Mundo</TabsTrigger>
              <TabsTrigger value="layout-ume">Layout UME</TabsTrigger>
              <TabsTrigger value="layout-odres-cred">Layout Odres Cred</TabsTrigger>
            </TabsList>
            <TabsContent value="imagem" className="mt-4">
              <ColarImagemTab />
            </TabsContent>
            <TabsContent value="layout-ume" className="mt-4">
              <LayoutUmeTab />
            </TabsContent>
            <TabsContent value="layout-odres-cred" className="mt-4">
              <LayoutUmeTab credor="odres_cred" />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
