import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit2 } from 'lucide-react';

export interface MetaMsgRapida {
  id: string; titulo: string; tipo: string;
  conteudo: string | null; audio_url: string | null;
}

interface Props { open: boolean; onOpenChange: (o: boolean) => void; onChange: () => void; }

export function MetaMensagensRapidasDialog({ open, onOpenChange, onChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [lista, setLista] = useState<MetaMsgRapida[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');

  const carregar = async () => {
    if (!user) return;
    const { data } = await supabase.from('meta_whatsapp_mensagens_rapidas')
      .select('*').eq('user_id', user.id).order('ordem');
    setLista((data as MetaMsgRapida[]) ?? []);
  };
  useEffect(() => { if (open) carregar(); }, [open, user]);

  const limpar = () => { setEditandoId(null); setTitulo(''); setConteudo(''); };

  const salvar = async () => {
    if (!titulo.trim() || !conteudo.trim() || !user) return;
    if (editandoId) {
      await supabase.from('meta_whatsapp_mensagens_rapidas')
        .update({ titulo: titulo.trim(), conteudo: conteudo.trim() })
        .eq('id', editandoId);
    } else {
      await supabase.from('meta_whatsapp_mensagens_rapidas').insert({
        user_id: user.id, titulo: titulo.trim(), tipo: 'texto', conteudo: conteudo.trim(), ordem: lista.length,
      });
    }
    limpar(); await carregar(); onChange();
  };

  const excluir = async (id: string) => {
    await supabase.from('meta_whatsapp_mensagens_rapidas').delete().eq('id', id);
    await carregar(); onChange();
  };

  const editar = (m: MetaMsgRapida) => {
    setEditandoId(m.id); setTitulo(m.titulo); setConteudo(m.conteudo || '');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) limpar(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Mensagens rápidas Meta</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Título (ex: Saudação)" value={titulo} onChange={e => setTitulo(e.target.value)} />
          <Textarea placeholder="Conteúdo (texto livre — só envia dentro da janela 24h)"
            value={conteudo} onChange={e => setConteudo(e.target.value)} rows={3} />
          <div className="flex gap-2">
            <Button onClick={salvar} disabled={!titulo.trim() || !conteudo.trim()} className="flex-1">
              <Plus className="h-4 w-4 mr-1" /> {editandoId ? 'Salvar' : 'Adicionar'}
            </Button>
            {editandoId && <Button variant="outline" onClick={limpar}>Cancelar</Button>}
          </div>
          {lista.length > 0 && (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {lista.map(m => (
                <div key={m.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-accent/30">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{m.titulo}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.conteudo}</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => editar(m)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => excluir(m.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
