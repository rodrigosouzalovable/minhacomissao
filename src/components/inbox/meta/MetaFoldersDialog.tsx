import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Plus, Users } from 'lucide-react';
import { MetaFolderAcessoDialog } from './MetaFolderAcessoDialog';
import { useUserRole } from '@/hooks/useUserRole';

export interface MetaInboxFolder {
  id: string;
  nome: string;
  cor: string;
  owner_id: string;
}

interface Funcionario { user_id: string; nome: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentUserId: string;
  onChanged: () => void;
}

const CORES = ['#25D366', '#FF6B6B', '#4ECDC4', '#FFD93D', '#6C5CE7', '#FF8A5C', '#EA4C89', '#00B4D8'];

export function MetaFoldersDialog({ open, onOpenChange, currentUserId, onChanged }: Props) {
  const { toast } = useToast();
  const [folders, setFolders] = useState<MetaInboxFolder[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [membersByFolder, setMembersByFolder] = useState<Record<string, Set<string>>>({});
  const [novoNome, setNovoNome] = useState('');
  const [novaCor, setNovaCor] = useState(CORES[0]);
  const [busy, setBusy] = useState(false);
  const [acessoFolder, setAcessoFolder] = useState<MetaInboxFolder | null>(null);
  const { isAdmin } = useUserRole();

  const load = useCallback(async () => {
    const { data: fs } = await supabase.from('meta_inbox_folders')
      .select('id, nome, cor, owner_id')
      .order('nome');
    setFolders((fs as any) ?? []);
    const { data: ms } = await supabase.from('meta_inbox_folder_members')
      .select('folder_id, user_id');
    const map: Record<string, Set<string>> = {};
    for (const r of (ms as any[]) ?? []) {
      if (!map[r.folder_id]) map[r.folder_id] = new Set();
      map[r.folder_id].add(r.user_id);
    }
    setMembersByFolder(map);
    const { data: funcs } = await (supabase as any).rpc('listar_funcionarios');
    setFuncionarios((funcs as any) ?? []);
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  const criar = async () => {
    const nome = novoNome.trim();
    if (!nome) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('meta_inbox_folders').insert({
        nome, cor: novaCor, owner_id: currentUserId,
      } as any);
      if (error) {
        console.error('[MetaFoldersDialog] Erro ao criar caixa:', error);
        toast({ title: 'Erro ao criar caixa', description: error.message, variant: 'destructive' });
        return;
      }
      setNovoNome('');
      await load();
      onChanged();
      toast({ title: 'Caixa criada', description: `A caixa ${nome} já está disponível para campanhas.` });
    } catch (error) {
      console.error('[MetaFoldersDialog] Falha inesperada ao criar caixa:', error);
      toast({
        title: 'Erro ao criar caixa',
        description: error instanceof Error ? error.message : 'Não foi possível criar a caixa. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const excluir = async (id: string) => {
    if (!confirm('Excluir esta caixa? As conversas voltarão para a caixa padrão.')) return;
    // Move contatos primeiro
    await supabase.from('meta_whatsapp_contatos').update({ folder_id: null } as any).eq('folder_id', id);
    const { error } = await supabase.from('meta_inbox_folders').delete().eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    await load();
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Caixas de mensagens</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 border rounded p-3">
          <Label className="text-sm">Nova caixa</Label>
          <div className="flex gap-2">
            <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex.: CERTIFICADO" maxLength={60} />
            <select className="border rounded px-2 text-sm" value={novaCor} onChange={(e) => setNovaCor(e.target.value)} style={{ backgroundColor: novaCor, color: '#fff' }}>
              {CORES.map((c) => <option key={c} value={c} style={{ backgroundColor: c }}>{c}</option>)}
            </select>
            <Button onClick={criar} disabled={busy || !novoNome.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Criar
            </Button>
          </div>
        </div>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-2">
            {folders.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-6">Nenhuma caixa criada ainda.</div>
            )}
            {folders.map((f) => {
              const owned = f.owner_id === currentUserId || isAdmin;
              const members = membersByFolder[f.id] ?? new Set();
              return (
                <div key={f.id} className="border rounded p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge style={{ backgroundColor: f.cor, color: '#fff' }}>{f.nome}</Badge>
                    <span className="text-xs text-muted-foreground flex-1">
                      {owned ? 'Sua caixa' : 'Compartilhada'}
                    </span>
                    {owned && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setAcessoFolder(f)}>
                          <Users className="h-3.5 w-3.5 mr-1" /> Acesso ({members.size})
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => excluir(f.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>

        <MetaFolderAcessoDialog
          open={!!acessoFolder}
          onOpenChange={(v) => { if (!v) setAcessoFolder(null); }}
          folderId={acessoFolder?.id ?? null}
          folderNome={acessoFolder?.nome ?? ''}
          onChanged={() => { load(); onChanged(); }}
        />
      </DialogContent>
    </Dialog>
  );
}
