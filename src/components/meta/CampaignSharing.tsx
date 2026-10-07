import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Share2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function CampaignSharing({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; nome: string | null }>>([]);
  const [shared, setShared] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    let live = true;
    setBusy(true);
    Promise.all([
      supabase.rpc('usuarios_compartilhar_campanha', { _job_id: jobId }),
      supabase.from('envio_meta_compartilhamentos').select('user_id').eq('job_id', jobId),
    ]).then(([people, grants]) => {
      if (!live) return;
      if (people.error || grants.error) { toast.error('Não foi possível carregar os acessos.'); return; }
      setUsers(people.data || []);
      setShared((grants.data || []).map(g => g.user_id));
    }).finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [open, jobId]);
  const toggle = async (id: string) => {
    setBusy(true);
    try {
      const removing = shared.includes(id);
      const { error } = removing
        ? await supabase.from('envio_meta_compartilhamentos').delete().eq('job_id', jobId).eq('user_id', id)
        : await supabase.from('envio_meta_compartilhamentos').insert({ job_id: jobId, user_id: id });
      if (error) throw error;
      setShared(prev => removing ? prev.filter(u => u !== id) : [...prev, id]);
      toast.success(removing ? 'Acesso removido.' : 'Visualização compartilhada. O usuário verá a campanha pelo botão Campanhas.');
    } catch { toast.error('Não foi possível alterar o acesso.'); }
    finally { setBusy(false); }
  };
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button size="sm" variant="outline"><Share2 className="mr-2 h-4 w-4" />Compartilhar visualização</Button></PopoverTrigger>
    <PopoverContent align="start" className="w-80 space-y-3">
      <p className="text-sm font-medium">Usuários com acesso de leitura ({shared.length})</p>
      <Input aria-label="Buscar usuário para compartilhar" placeholder="Buscar usuário" value={search} onChange={e => setSearch(e.target.value)} />
      <div className="max-h-64 overflow-auto space-y-1">
        {busy && !users.length && <Loader2 className="h-4 w-4 animate-spin" />}
        {users.filter(u => (u.nome || '').toLowerCase().includes(search.toLowerCase())).map(u => <label key={u.id} className="flex items-center gap-2 py-2 text-sm cursor-pointer"><Checkbox disabled={busy} checked={shared.includes(u.id)} onCheckedChange={() => void toggle(u.id)} /><span className="break-words">{u.nome || 'Usuário sem nome'}</span></label>)}
      </div>
    </PopoverContent>
  </Popover>;
}