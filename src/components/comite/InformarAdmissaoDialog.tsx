import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CalendarPlus } from 'lucide-react';

interface Props {
  userId: string;
  nome: string;
  onSaved: () => void;
}

export function InformarAdmissaoDialog({ userId, nome, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState('');
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!data) {
      toast.error('Informe a data');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ data_admissao: data })
      .eq('id', userId);
    setSaving(false);
    if (error) {
      toast.error('Erro: ' + error.message);
      return;
    }
    toast.success('Data de admissão salva');
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
          <CalendarPlus className="h-3 w-3 mr-1" /> informar admissão
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Data de admissão — {nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Sem essa data o sistema não calcula "Tempo em casa". Após salvar, o painel atualiza sozinho.
          </p>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
