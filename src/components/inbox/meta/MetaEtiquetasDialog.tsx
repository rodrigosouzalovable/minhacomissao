import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Trash2, Plus, Pencil, Check, X, Tag } from 'lucide-react';
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
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editCor, setEditCor] = useState(CORES[0]);

  const criar = async () => {
    if (!nome.trim() || !user) return;
    const { error } = await supabase.from('meta_whatsapp_etiquetas').insert({
      user_id: user.id, nome: nome.trim(), cor,
    });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    setNome(''); setCor(CORES[0]); onChange();
  };
  const excluir = async (id: string) => {
    const { error } = await supabase.from('meta_whatsapp_etiquetas').delete().eq('id', id);
    if (error) {
      toast({
        title: 'Não é possível remover',
        description: 'Etiquetas de atendente aplicadas automaticamente só podem ser removidas por um administrador.',
        variant: 'destructive',
      });
      return;
    }
    onChange();
  };

  const iniciarEdicao = (et: MetaEtiqueta) => {
    setEditandoId(et.id);
    setEditNome(et.nome);
    setEditCor(et.cor);
  };
  const cancelarEdicao = () => {
    setEditandoId(null);
    setEditNome('');
  };
  const salvarEdicao = async (id: string) => {
    if (!editNome.trim()) return;
    const { data, error } = await supabase
      .from('meta_whatsapp_etiquetas')
      .update({ nome: editNome.trim(), cor: editCor })
      .eq('id', id)
      .select('id');
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    if (!data || data.length === 0) {
      toast({
        title: 'Sem permissão',
        description: 'Esta etiqueta foi criada por outro usuário. Apenas o administrador pode editá-la.',
        variant: 'destructive',
      });
      return;
    }
    cancelarEdicao();
    onChange();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4" /> Etiquetas Meta
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Nova etiqueta */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nova etiqueta
            </p>
            <Input
              placeholder="Nome da etiqueta..."
              value={nome}
              onChange={e => setNome(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && criar()}
            />
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Cor</p>
              <div className="grid grid-cols-8 gap-2">
                {CORES.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCor(c)}
                    className="h-6 w-6 rounded-full border-2 transition-transform"
                    style={{
                      backgroundColor: c,
                      borderColor: cor === c ? 'hsl(var(--foreground))' : 'transparent',
                      transform: cor === c ? 'scale(1.15)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
            </div>
            <Button size="sm" onClick={criar} disabled={!nome.trim()} className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Criar etiqueta
            </Button>
          </div>

          <Separator />

          {/* Etiquetas existentes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Etiquetas existentes
              </p>
              <span className="text-xs text-muted-foreground">
                {etiquetas.length} {etiquetas.length === 1 ? 'etiqueta' : 'etiquetas'}
              </span>
            </div>

            <div className="rounded-md border bg-muted/30 p-2 max-h-64 overflow-y-auto pr-1">
              {etiquetas.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Nenhuma etiqueta criada ainda.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {etiquetas.map(et => {
                    const emEdicao = editandoId === et.id;
                    if (emEdicao) {
                      return (
                        <div key={et.id} className="space-y-2 p-2 rounded-md bg-background border border-border">
                          <Input
                            value={editNome}
                            onChange={e => setEditNome(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') salvarEdicao(et.id);
                              if (e.key === 'Escape') cancelarEdicao();
                            }}
                            autoFocus
                          />
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Cor</p>
                            <div className="grid grid-cols-8 gap-2">
                              {CORES.map(c => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => setEditCor(c)}
                                  className="h-5 w-5 rounded-full border-2 transition-transform"
                                  style={{
                                    backgroundColor: c,
                                    borderColor: editCor === c ? 'hsl(var(--foreground))' : 'transparent',
                                    transform: editCor === c ? 'scale(1.15)' : 'scale(1)',
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            <Button size="sm" className="flex-1 h-7" onClick={() => salvarEdicao(et.id)} disabled={!editNome.trim()}>
                              <Check className="h-3.5 w-3.5 mr-1" /> Salvar
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7" onClick={cancelarEdicao}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={et.id}
                        className="flex items-center justify-between gap-2 h-10 px-2 rounded-md bg-background hover:bg-accent/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div
                            className="h-3.5 w-3.5 rounded-full shrink-0"
                            style={{ backgroundColor: et.cor }}
                          />
                          <span className="text-sm font-medium truncate">{et.nome}</span>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0 border-l pl-1 ml-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => iniciarEdicao(et)}
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => excluir(et.id)}
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
