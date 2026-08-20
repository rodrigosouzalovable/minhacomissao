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
  const [admins, setAdmins] = useState<Set<string>>(new Set());
  const [naFila, setNaFila] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadFila = useCallback(async () => {
    // Consulta segura no servidor: quem realmente está na fila (etiqueta + fila ativa + permissão)
    const { data } = await (supabase as any).rpc('meta_fila_status_caixa', { _folder: folderId });
    setNaFila(new Set(((data as any[]) ?? []).filter((r) => r.na_fila).map((r) => r.user_id)));
  }, [folderId]);


  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: funcs } = await (supabase as any).rpc('listar_usuarios_ativos');
      setFuncionarios(((funcs as Funcionario[]) ?? []).slice().sort((a, b) => a.nome.localeCompare(b.nome)));

      if (folderId === null) {
        const { data } = await (supabase as any)
          .from('meta_inbox_default_members')
          .select('user_id, admin');
        setMembros(new Set(((data as any[]) ?? []).map((r) => r.user_id)));
        setAdmins(new Set(((data as any[]) ?? []).filter((r) => r.admin).map((r) => r.user_id)));
      } else {
        const { data } = await (supabase as any)
          .from('meta_inbox_folder_members')
          .select('user_id, admin')
          .eq('folder_id', folderId);
        setMembros(new Set(((data as any[]) ?? []).map((r) => r.user_id)));
        setAdmins(new Set(((data as any[]) ?? []).filter((r) => r.admin).map((r) => r.user_id)));
      }
      await loadFila();
    } finally {
      setLoading(false);
    }
  }, [folderId, loadFila]);

  useEffect(() => { if (open) { setBusca(''); load(); } }, [open, load]);


  const toggle = async (userId: string, checked: boolean, comoAdmin = false) => {
    setSaving(true);
    try {
      let error: any = null;
      const tabela = folderId === null ? 'meta_inbox_default_members' : 'meta_inbox_folder_members';
      if (checked) {
        const payload: any = folderId === null
          ? { user_id: userId, admin: comoAdmin }
          : { folder_id: folderId, user_id: userId, admin: comoAdmin };
        ({ error } = await (supabase as any).from(tabela).insert(payload));
      } else {
        let q = (supabase as any).from(tabela).delete().eq('user_id', userId);
        if (folderId !== null) q = q.eq('folder_id', folderId);
        ({ error } = await q);
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
      setAdmins((prev) => {
        const n = new Set(prev);
        if (checked && comoAdmin) n.add(userId); else n.delete(userId);
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

  const toggleAdmin = async (userId: string, checked: boolean) => {
    // Marcar como admin garante que o usuário também seja atendente da caixa
    if (checked && !membros.has(userId)) {
      await toggle(userId, true, true);
      return;
    }
    setSaving(true);
    try {
      const tabela = folderId === null ? 'meta_inbox_default_members' : 'meta_inbox_folder_members';
      let q = (supabase as any).from(tabela).update({ admin: checked }).eq('user_id', userId);
      if (folderId !== null) q = q.eq('folder_id', folderId);
      const { error } = await q;
      if (error) {
        toast({ title: 'Erro ao definir admin da caixa', description: error.message, variant: 'destructive' });
        return;
      }
      setAdmins((prev) => {
        const n = new Set(prev);
        if (checked) n.add(userId); else n.delete(userId);
        return n;
      });
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
            <div key={u.user_id} className="flex items-center gap-2 text-sm hover:bg-accent/40 rounded px-1.5 py-1">
              <label className="flex flex-1 items-center gap-2 min-w-0 cursor-pointer">
                <Checkbox checked={membros.has(u.user_id)} onCheckedChange={(v) => toggle(u.user_id, !!v)} />
                <span className="flex-1 truncate">{u.nome}</span>
              </label>
              {/^\s*iago\b/i.test(u.nome) && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/15 text-primary shrink-0">
                  IA
                </span>
              )}
              {membros.has(u.user_id) && !naFila.has(u.user_id) && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 shrink-0">
                  fora da fila
                </span>
              )}
              <label
                className="flex items-center gap-1 shrink-0 cursor-pointer text-[10px] text-muted-foreground"
                title="Admin desta caixa: pode ativar/desativar outros atendentes"
              >
                <Checkbox checked={admins.has(u.user_id)} onCheckedChange={(v) => toggleAdmin(u.user_id, !!v)} />
                Admin
              </label>
            </div>

          ))}

        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
