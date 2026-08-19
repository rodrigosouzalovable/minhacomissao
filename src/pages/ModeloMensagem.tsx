import { AppLayout } from '@/components/layout/AppLayout';
import { ColarImagemTab } from '@/components/modelo-mensagem/ColarImagemTab';
import { LayoutPlanilhaTab } from '@/components/modelo-mensagem/LayoutPlanilhaTab';
import { LayoutUazapiTab } from '@/components/modelo-mensagem/LayoutUazapiTab';
import { LayoutVistaParcelamentoTab } from '@/components/modelo-mensagem/LayoutVistaParcelamentoTab';
import { EditarTemplateMensagemDialog } from '@/components/EditarTemplateMensagemDialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings } from 'lucide-react';
import { useState } from 'react';
import { useUserRole } from '@/hooks/useUserRole';

export default function ModeloMensagem() {
  const [editOpen, setEditOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { isAdmin } = useUserRole();

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">Modelo Mensagem</h1>
            <p className="text-sm text-muted-foreground">
              Cole o print do Cob+ e gere a mensagem de negociação do cliente.
            </p>
          </div>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Settings className="h-4 w-4 mr-2" /> Editar Modelo
          </Button>
        </div>

        {isAdmin ? (
          <Tabs defaultValue="imagem">
            <TabsList>
              <TabsTrigger value="imagem">Colar imagem</TabsTrigger>
              <TabsTrigger value="planilha">Layout Parcelamento</TabsTrigger>
              <TabsTrigger value="vista-parcelamento">Layout à vista + parcelamento</TabsTrigger>
              <TabsTrigger value="uazapi">Layout Uazapi</TabsTrigger>
            </TabsList>
            <TabsContent value="imagem" className="mt-4">
              <ColarImagemTab key={reloadKey} />
            </TabsContent>
            <TabsContent value="planilha" className="mt-4">
              <LayoutPlanilhaTab />
            </TabsContent>
            <TabsContent value="vista-parcelamento" className="mt-4">
              <LayoutVistaParcelamentoTab />
            </TabsContent>
            <TabsContent value="uazapi" className="mt-4">
              <LayoutUazapiTab />
            </TabsContent>
          </Tabs>
        ) : (

          <ColarImagemTab key={reloadKey} />
        )}
      </div>

      <EditarTemplateMensagemDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={() => setReloadKey((k) => k + 1)}
      />
    </AppLayout>
  );
}
