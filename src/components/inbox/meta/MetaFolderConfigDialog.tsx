import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/** Sentinela usada para representar a caixa Padrão (folder_id IS NULL). */
export const CAIXA_PADRAO_ID = '00000000-0000-0000-0000-000000000000';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folderId: string | null;
  folderNome: string;
  qualificacaoAtiva: boolean;
  onChanged: () => void;
}

export function MetaFolderConfigDialog({
  open, onOpenChange, folderId, folderNome, qualificacaoAtiva, onChanged,
}: Props) {
  const { toast } = useToast();
  const [ativo, setAtivo] = useState(qualificacaoAtiva);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (open) setAtivo(qualificacaoAtiva); }, [open, qualificacaoAtiva]);

  const salvar = async (valor: boolean) => {
    setAtivo(valor);
    setSalvando(true);
    const { error } = await (supabase as any).from('meta_qualificacao_caixa').upsert(
      { folder_id: folderId ?? CAIXA_PADRAO_ID, ativo: valor, updated_at: new Date().toISOString() },
      { onConflict: 'folder_id' },
    );
    setSalvando(false);
    if (error) {
      setAtivo(!valor);
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar caixa · {folderNome}</DialogTitle>
          <DialogDescription>Ajustes específicos desta caixa de mensagens.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
          <div className="space-y-0.5">
            <Label className="text-sm">Qualificação de conversas</Label>
            <p className="text-xs text-muted-foreground">
              Exibe o botão "Qualificação" nas conversas e destaca em azul as ainda não qualificadas.
            </p>
          </div>
          <Switch checked={ativo} disabled={salvando} onCheckedChange={salvar} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
