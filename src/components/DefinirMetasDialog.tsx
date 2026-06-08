import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Target, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function DefinirMetasDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [mesAno, setMesAno] = useState(format(new Date(), 'yyyy-MM'));
  const [valores, setValores] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: funcionarios } = useQuery({
    queryKey: ['definir-metas-funcionarios'],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['funcionario', 'gestor']);
      const ids = (roles || []).map(r => r.user_id);
      if (!ids.length) return [];
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, nome, email')
        .in('id', ids)
        .order('nome');
      return profs || [];
    },
    enabled: open,
  });

  const { data: metas } = useQuery({
    queryKey: ['definir-metas-existentes', mesAno],
    queryFn: async () => {
      const { data } = await supabase
        .from('metas_funcionarios' as any)
        .select('user_id, valor_meta')
        .eq('mes_ano', mesAno);
      return (data as any) || [];
    },
    enabled: open,
  });

  useEffect(() => {
    if (!metas || !funcionarios) return;
    const map: Record<string, string> = {};
    for (const f of funcionarios) {
      const m = metas.find((x: any) => x.user_id === f.id);
      map[f.id] = m ? String(Number(m.valor_meta)).replace('.', ',') : '';
    }
    setValores(map);
  }, [metas, funcionarios]);

  const replicarMesAnterior = async () => {
    const d = new Date(mesAno + '-01T12:00:00');
    d.setMonth(d.getMonth() - 1);
    const ant = format(d, 'yyyy-MM');
    const { data } = await supabase
      .from('metas_funcionarios' as any)
      .select('user_id, valor_meta')
      .eq('mes_ano', ant);
    if (!data?.length) {
      toast.info(`Sem metas em ${ant}`);
      return;
    }
    const map = { ...valores };
    for (const m of data as any[]) {
      map[m.user_id] = String(Number(m.valor_meta)).replace('.', ',');
    }
    setValores(map);
    toast.success(`${data.length} valores copiados de ${ant}`);
  };

  const salvar = async () => {
    setSaving(true);
    try {
      const rows = Object.entries(valores)
        .map(([user_id, raw]) => {
          const v = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
          return { user_id, mes_ano: mesAno, valor_meta: isNaN(v) ? 0 : v };
        })
        .filter(r => r.valor_meta > 0);

      if (!rows.length) {
        toast.error('Defina ao menos um valor');
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('metas_funcionarios' as any)
        .upsert(rows as any, { onConflict: 'user_id,mes_ano' });

      if (error) throw error;
      toast.success(`${rows.length} metas salvas!`);
      qc.invalidateQueries({ queryKey: ['meta-banner'] });
      qc.invalidateQueries({ queryKey: ['definir-metas-existentes'] });
      qc.invalidateQueries({ queryKey: ['metas-mensal'] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Definir Metas dos Funcionários
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label htmlFor="mes">Mês de referência</Label>
              <Input id="mes" type="month" value={mesAno} onChange={e => setMesAno(e.target.value)} />
            </div>
            <Button variant="outline" onClick={replicarMesAnterior}>Replicar mês anterior</Button>
          </div>

          <ScrollArea className="h-[400px] pr-3">
            <div className="space-y-2">
              {!funcionarios && <p className="text-sm text-muted-foreground">Carregando...</p>}
              {funcionarios?.map(f => (
                <div key={f.id} className="flex items-center gap-3 border rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{f.nome || f.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{f.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">R$</span>
                    <Input
                      value={valores[f.id] || ''}
                      onChange={e => setValores(v => ({ ...v, [f.id]: e.target.value }))}
                      placeholder="0,00"
                      className="w-32"
                    />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Metas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
