import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search } from 'lucide-react';

interface Funcionario { user_id: string; nome: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** null = caixa Padrão */
  folderId: string | null;
  folderNome: string;
  onChanged?: () => void;
}

export function MetaFolderAcessoDialog({ open, onOpenChange, folderId, folderNome, onChanged }: Props) {
  const { toast } = useToast();
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [membros, setMembros] = useState<Set<string>>(new Set());
  const [naFila, setNaFila] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadFila = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('meta_atendimento_fila')
      .select('user_id')
      .eq('ativo', true);
    setNaFila(new Set(((data as any[]) ?? []).map((r) => r.user_id).filter(Boolean)));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: funcs } = await (supabase as any).rpc('listar_usuarios_ativos');
      setFuncionarios(((funcs as Funcionario[]) ?? []).slice().sort((a, b) => a.nome.localeCompare(b.nome)));

      if (folderId === null) {
        const { data } = await (supabase as any)
          .from('meta_inbox_default_members')
          .select('user_id');
        setMembros(new Set(((data as any[]) ?? []).map((r) => r.user_id)));
      } else {
        const { data } = await supabase
          .from('meta_inbox_folder_members')
          .select('user_id')
          .eq('folder_id', folderId);
        setMembros(new Set(((data as any[]) ?? []).map((r) => r.user_id)));
      }
      await loadFila();
    } finally {
      setLoading(false);
    }
  }, [folderId, loadFila]);

  useEffect(() => { if (open) { setBusca(''); load(); } }, [open, load]);


  const toggle = async (userId: string, checked: boolean) => {
    setSaving(true);
    try {
      let error: any = null;
      if (folderId === null) {
        if (checked) {
          ({ error } = await (supabase as any).from('meta_inbox_default_members').insert({ user_id: userId }));
        } else {
          ({ error } = await (supabase as any).from('meta_inbox_default_members').delete().eq('user_id', userId));
        }
      } else {
        if (checked) {
          ({ error } = await supabase.from('meta_inbox_folder_members').insert({ folder_id: folderId, user_id: userId } as any));
        } else {
          ({ error } = await supabase.from('meta_inbox_folder_members').delete()
            .eq('folder_id', folderId).eq('user_id', userId));
        }
      }
      if (error) {
        toast({ title: 'Erro ao salvar acesso', description: error.message, variant: 'destructive' });
        return;
      }
      setMembros((prev) => {
        const n = new Set(prev);
        if (checked) n.add(userId); else n.delete(userId);
        return n;
      });
      if (checked) {
        // Garante etiqueta "Atendente: <nome>" + entrada na fila de distribuição
        await (supabase as any).rpc('meta_provisionar_atendentes_fila', { _folder: folderId });
        await loadFila();
      }
      onChanged?.();

    } finally {
      setSaving(false);
    }
  };

  const setTodos = async (checked: boolean) => {
    const alvo = funcionarios.filter((f) => membros.has(f.user_id) !== checked);
    for (const f of alvo) {
      // eslint-disable-next-line no-await-in-loop
      await toggle(f.user_id, checked);
    }
  };

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return funcionarios;
    return funcionarios.filter((f) => f.nome.toLowerCase().includes(t));
  }, [funcionarios, busca]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atendentes da caixa "{folderNome}" ({membros.size})</DialogTitle>
          <DialogDescription>
            Somente os usuários selecionados poderão ver e atender as conversas desta caixa. Administradores sempre têm acesso.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar usuário..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={saving} onClick={() => setTodos(true)}>Marcar todos</Button>
          <Button size="sm" variant="outline" disabled={saving} onClick={() => setTodos(false)}>Desmarcar todos</Button>
          {saving && <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" />}
        </div>

        <ScrollArea className="h-72 border rounded p-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filtrados.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-6">Nenhum usuário encontrado.</div>
          ) : filtrados.map((u) => (
            <label key={u.user_id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/40 rounded px-1.5 py-1">
              <Checkbox checked={membros.has(u.user_id)} onCheckedChange={(v) => toggle(u.user_id, !!v)} />
              <span className="flex-1 truncate">{u.nome}</span>
              {membros.has(u.user_id) && !naFila.has(u.user_id) && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 shrink-0">
                  fora da fila
                </span>
              )}
            </label>

          ))}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
