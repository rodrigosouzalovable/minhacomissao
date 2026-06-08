import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Copy } from 'lucide-react';
import { format, addMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';

type Tabela = 'gastos_empresa' | 'gastos_funcionarios' | 'receitas_empresa';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tabela: Tabela;
  onSuccess: () => void;
}

const labelMap: Record<Tabela, string> = {
  gastos_empresa: 'gastos da empresa',
  gastos_funcionarios: 'gastos de funcionários',
  receitas_empresa: 'receitas',
};

export function ReplicarMesesDialog({ open, onOpenChange, tabela, onSuccess }: Props) {
  const { toast } = useToast();
  const hoje = new Date();
  const [mesOrigem, setMesOrigem] = useState(format(hoje, 'yyyy-MM'));
  const [destinos, setDestinos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [countOrigem, setCountOrigem] = useState<number | null>(null);

  // Lista de meses: 12 anteriores + 12 posteriores ao origem
  const mesesLista = useMemo(() => {
    const base = parseISO(mesOrigem + '-01');
    const arr: { value: string; label: string }[] = [];
    for (let i = -12; i <= 12; i++) {
      if (i === 0) continue;
      const d = addMonths(base, i);
      arr.push({ value: format(d, 'yyyy-MM'), label: format(d, 'MM/yyyy') });
    }
    return arr;
  }, [mesOrigem]);

  // Conta registros do mês origem
  useEffect(() => {
    if (!open) return;
    const inicio = format(startOfMonth(parseISO(mesOrigem + '-01')), 'yyyy-MM-dd');
    const fim = format(endOfMonth(parseISO(mesOrigem + '-01')), 'yyyy-MM-dd');
    (supabase as any)
      .from(tabela)
      .select('id', { count: 'exact', head: true })
      .gte('data_referencia', inicio)
      .lte('data_referencia', fim)
      .then(({ count }: any) => setCountOrigem(count ?? 0));
  }, [mesOrigem, open, tabela]);

  useEffect(() => {
    if (open) {
      setDestinos(new Set());
      setMesOrigem(format(new Date(), 'yyyy-MM'));
    }
  }, [open]);

  const toggle = (v: string) => {
    setDestinos((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  };

  const marcarAnteriores = () => {
    setDestinos(new Set(mesesLista.filter((m) => m.value < mesOrigem).slice(-6).map((m) => m.value)));
  };
  const marcarPosteriores = () => {
    setDestinos(new Set(mesesLista.filter((m) => m.value > mesOrigem).slice(0, 6).map((m) => m.value)));
  };

  const handleReplicar = async () => {
    if (destinos.size === 0) {
      toast({ title: 'Selecione ao menos um mês de destino', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const inicio = format(startOfMonth(parseISO(mesOrigem + '-01')), 'yyyy-MM-dd');
      const fim = format(endOfMonth(parseISO(mesOrigem + '-01')), 'yyyy-MM-dd');
      const { data: origens, error: errO } = await (supabase as any)
        .from(tabela)
        .select('*')
        .gte('data_referencia', inicio)
        .lte('data_referencia', fim);
      if (errO) throw errO;
      if (!origens || origens.length === 0) {
        toast({ title: 'O mês de origem não tem lançamentos', variant: 'destructive' });
        setLoading(false);
        return;
      }

      const inserts: any[] = [];
      let pulados = 0;
      let replicados = 0;

      for (const mes of destinos) {
        const dInicio = format(startOfMonth(parseISO(mes + '-01')), 'yyyy-MM-dd');
        const dFim = format(endOfMonth(parseISO(mes + '-01')), 'yyyy-MM-dd');
        const novaData = mes + '-01';

        if (tabela === 'gastos_funcionarios') {
          // Check por funcionário
          const { data: existentes } = await (supabase as any)
            .from('gastos_funcionarios')
            .select('funcionario_id')
            .gte('data_referencia', dInicio)
            .lte('data_referencia', dFim);
          const setExist = new Set((existentes || []).map((r: any) => r.funcionario_id));
          let acrescentou = false;
          for (const o of origens) {
            if (setExist.has(o.funcionario_id)) continue;
            const { id, criado_em, profiles, ...rest } = o;
            inserts.push({ ...rest, data_referencia: novaData });
            acrescentou = true;
          }
          if (acrescentou) replicados++; else pulados++;
        } else {
          const { count } = await (supabase as any)
            .from(tabela)
            .select('id', { count: 'exact', head: true })
            .gte('data_referencia', dInicio)
            .lte('data_referencia', dFim);
          if ((count ?? 0) > 0) {
            pulados++;
            continue;
          }
          for (const o of origens) {
            const { id, criado_em, ...rest } = o;
            inserts.push({ ...rest, data_referencia: novaData });
          }
          replicados++;
        }
      }

      if (inserts.length > 0) {
        const { error: errI } = await (supabase as any).from(tabela).insert(inserts);
        if (errI) throw errI;
      }

      toast({
        title: 'Replicação concluída',
        description: `${replicados} mês(es) replicado(s) · ${pulados} pulado(s) (já tinham lançamentos).`,
      });
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro ao replicar', description: e?.message || '', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Replicar {labelMap[tabela]} para outros meses
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Mês de origem *</Label>
            <Input
              type="month"
              value={mesOrigem}
              onChange={(e) => setMesOrigem(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {countOrigem === null ? 'Calculando…' : `${countOrigem} lançamento(s) neste mês.`}
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label>Meses de destino *</Label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={marcarAnteriores}>Marcar 6 anteriores</Button>
                <Button type="button" variant="outline" size="sm" onClick={marcarPosteriores}>Marcar 6 posteriores</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setDestinos(new Set())}>Limpar</Button>
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-72 overflow-y-auto border rounded p-3">
              {mesesLista.map((m) => (
                <label key={m.value} className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={destinos.has(m.value)}
                    onCheckedChange={() => toggle(m.value)}
                  />
                  {m.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Meses que já tiverem lançamentos serão pulados automaticamente.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleReplicar} disabled={loading || destinos.size === 0}>
            {loading ? 'Replicando…' : `Replicar para ${destinos.size} mês(es)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
