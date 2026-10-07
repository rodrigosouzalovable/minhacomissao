import { useRef, useState } from 'react';
import { Power, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { motivoRecusaReativacao, podeOferecerReativacao, type PoolInstance } from '@/lib/metaInboxReactivation';
export function MetaPoolReactivation({ instancia, userId, isAdmin, parceiroMeta, onUpdated }: {
  instancia: PoolInstance & { nome?: string | null; display_phone?: string | null };
  userId?: string; isAdmin: boolean; parceiroMeta: boolean; onUpdated: (i: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const [aceito, setAceito] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const { toast } = useToast();
  if ((!isAdmin && !parceiroMeta) || !podeOferecerReativacao(instancia)) return null;
  const authorized = async () => {
    if (!userId) throw new Error('Sessão inválida. Entre novamente.');
    if (isAdmin) return;
    const { data, error } = await supabase.rpc('parceiro_tem_instancia', { _uid: userId, _instancia: instancia.id });
    if (error || data !== true) throw new Error('Parceiros Meta só podem reativar suas próprias instâncias.');
  };
  const reativar = async () => {
    if (!aceito || lock.current) return;
    lock.current = true; setBusy(true);
    try {
      await authorized();
      const { data: atual, error: readError } = await supabase.from('meta_whatsapp_instances')
        .select('id, ativo, provider, saude_quality, estado_pool, pausa_automatica_motivo, pool_fora_manual').eq('id', instancia.id).single();
      if (readError || !atual) throw new Error('Não foi possível conferir o estado atual desta instância.');
      if (atual.pool_fora_manual) throw new Error('Este número foi retirado manualmente. Reative-o pela aba Instâncias.');
      if (!podeOferecerReativacao(atual)) { onUpdated(atual); throw new Error('O estado da instância mudou. Confira o aviso atualizado.'); }
      const { data: health, error } = await supabase.functions.invoke('check-meta-instance-health', { body: { instancia_id: instancia.id } });
      if (error) throw new Error('Não foi possível consultar a Meta. Nada foi reativado; tente novamente.');
      const recusa = motivoRecusaReativacao(health?.results?.find((r: any) => r.instancia_id === instancia.id), instancia.id);
      if (recusa) throw new Error(recusa);
      const { data: updated, error: activationError } = await supabase.rpc('ativar_meta_instancia_pool', { p_instancia_id: instancia.id });
      if (activationError) throw activationError;
      onUpdated(updated); setOpen(false);
      toast({ title: 'Instância reativada no pool', description: 'A qualidade na Meta não foi alterada. Nenhuma mensagem foi enviada por esta ação.' });
    } catch (error) {
      const { data } = await supabase.rpc('get_meta_whatsapp_active_instances_for_sending');
      const latest = data?.find((i: any) => i.id === instancia.id);
      if (latest) onUpdated(latest);
      toast({ title: 'Não foi possível reativar', description: error instanceof Error ? error.message : 'Tente novamente.', variant: 'destructive' });
    } finally { lock.current = false; setBusy(false); }
  };
  return <>
    <div className="px-3 py-2 border-b bg-muted/30">
      <Button size="sm" variant="outline" onClick={async () => {
        try { await authorized(); setAceito(false); setOpen(true); }
        catch (e) { toast({ title: 'Reativação não autorizada', description: e instanceof Error ? e.message : 'Tente novamente.', variant: 'destructive' }); }
      }}><Power className="h-4 w-4 mr-2" />Reativar no pool</Button>
    </div>
    <Dialog open={open} onOpenChange={v => { if (!busy) setOpen(v); }}>
      <DialogContent><DialogHeader><DialogTitle>Reativar instância no pool?</DialogTitle>
        <DialogDescription>{instancia.nome || instancia.display_phone} — qualidade {instancia.saude_quality}. A Meta será consultada antes da reativação.</DialogDescription>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">Reativar não melhora a qualidade na Meta. Novos envios com qualidade baixa podem aumentar o risco de restrição. Bloqueios confirmados não serão liberados.</p>
      <label className="flex items-start gap-2 text-sm"><Checkbox checked={aceito} onCheckedChange={v => setAceito(v === true)} disabled={busy} />Estou ciente do risco e quero tentar reativar esta instância.</label>
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button>
        <Button disabled={!aceito || busy} onClick={reativar}>{busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Power className="h-4 w-4 mr-2" />}{busy ? 'Verificando na Meta…' : 'Verificar e reativar'}</Button>
      </DialogFooter></DialogContent>
    </Dialog>
  </>;
}
