import { AppLayout } from '@/components/AppLayout';
import { ColarImagemTab } from '@/components/modelo-mensagem/ColarImagemTab';
import { EditarTemplateMensagemDialog } from '@/components/EditarTemplateMensagemDialog';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { useState } from 'react';

export default function ModeloMensagem() {
  const [editOpen, setEditOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

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

        <ColarImagemTab key={reloadKey} />
      </div>

      <EditarTemplateMensagemDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={() => setReloadKey((k) => k + 1)}
      />
    </AppLayout>
  );
}
