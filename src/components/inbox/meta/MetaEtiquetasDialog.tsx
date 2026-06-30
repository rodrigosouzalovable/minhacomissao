import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const CORES = ['#25D366', '#FF6B6B', '#4ECDC4', '#FFD93D', '#6C5CE7', '#FF8A5C', '#EA4C89', '#00B4D8'];

export interface MetaEtiqueta { id: string; nome: string; cor: string; }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  etiquetas: MetaEtiqueta[];
  onChange: () => void;
}

export function MetaEtiquetasDialog({ open, onOpenChange, etiquetas, onChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState(CORES[0]);

  const criar = async () => {
    if (!nome.trim() || !user) return;
    const { error } = await supabase.from('meta_whatsapp_etiquetas').insert({
      user_id: user.id, nome: nome.trim(), cor,
    });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    setNome(''); setCor(CORES[0]); onChange();
  };
  const excluir = async (id: string) => {
    await supabase.from('meta_whatsapp_etiquetas').delete().eq('id', id);
    onChange();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Etiquetas Meta</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Input placeholder="Nome da etiqueta..." value={nome} onChange={e => setNome(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && criar()} />
            <div className="flex gap-1.5 flex-wrap">
              {CORES.map(c => (
                <button key={c} onClick={() => setCor(c)}
                  className="h-6 w-6 rounded-full border-2 transition-transform"
                  style={{ backgroundColor: c, borderColor: cor === c ? 'hsl(var(--foreground))' : 'transparent', transform: cor === c ? 'scale(1.2)' : 'scale(1)' }} />
              ))}
            </div>
            <Button size="sm" onClick={criar} disabled={!nome.trim()} className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Criar etiqueta
            </Button>
          </div>
          {etiquetas.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {etiquetas.map(et => (
                <div key={et.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-accent/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-3.5 w-3.5 rounded-full shrink-0" style={{ backgroundColor: et.cor }} />
                    <span className="text-sm truncate">{et.nome}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => excluir(et.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
