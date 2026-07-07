import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { formatarMoeda, formatarData } from '@/lib/comissao';
import { useToast } from '@/hooks/use-toast';

type Row = {
  id: string;
  cliente_nome: string;
  cliente_cpf: string | null;
  user_id: string;
  valor_total: number;
  parcelas: number;
  criado_em: string;
  funcionario_nome: string;
  primeira_parcela: string;
  dias_atraso: number;
};

const normalizeCpf = (c: string | null | undefined) => (c || '').replace(/\D/g, '');

async function fetchAbandonados(): Promise<Row[]> {
  const hoje = new Date();
  const limite = new Date(hoje);
  limite.setDate(limite.getDate() - 10);
  const limiteStr = limite.toISOString().slice(0, 10);

  const { data: acordos, error } = await supabase
    .from('acordos')
    .select('id, cliente_nome, cliente_cpf, user_id, valor_total, parcelas, criado_em')
    .eq('status', 'ativo');
  if (error) throw error;
  const ids = (acordos || []).map((a: any) => a.id);
  if (!ids.length) return [];

  // Buscar pagamentos em lotes
  const pagosSet = new Set<string>();
  const primeiraPorAcordo = new Map<string, string>();
  const chunkSize = 300;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data: pgs, error: pgErr } = await supabase
      .from('pagamentos')
      .select('acordo_id, status, data_prevista')
      .in('acordo_id', chunk);
    if (pgErr) throw pgErr;
    for (const p of pgs || []) {
      if (p.status === 'pago') pagosSet.add(p.acordo_id);
      const cur = primeiraPorAcordo.get(p.acordo_id);
      if (!cur || (p.data_prevista && p.data_prevista < cur)) {
        if (p.data_prevista) primeiraPorAcordo.set(p.acordo_id, p.data_prevista);
      }
    }
  }

  const filtrados = (acordos || []).filter((a: any) => {
    if (pagosSet.has(a.id)) return false;
    const primeira = primeiraPorAcordo.get(a.id);
    if (!primeira) return false;
    return primeira <= limiteStr;
  });

  const userIds = Array.from(new Set(filtrados.map((a: any) => a.user_id).filter(Boolean)));
  const nomeMap = new Map<string, string>();
  if (userIds.length) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, nome')
      .in('id', userIds);
    for (const p of profs || []) nomeMap.set(p.id, p.nome || '—');
  }

  const hojeMs = new Date(hoje.toISOString().slice(0, 10) + 'T00:00:00').getTime();
  return filtrados.map((a: any) => {
    const primeira = primeiraPorAcordo.get(a.id)!;
    const diasAtraso = Math.floor(
      (hojeMs - new Date(primeira + 'T00:00:00').getTime()) / 86400000,
    );
    return {
      id: a.id,
      cliente_nome: a.cliente_nome,
      cliente_cpf: a.cliente_cpf,
      user_id: a.user_id,
      valor_total: Number(a.valor_total || 0),
      parcelas: Number(a.parcelas || 0),
      criado_em: a.criado_em,
      funcionario_nome: nomeMap.get(a.user_id) || '—',
      primeira_parcela: primeira,
      dias_atraso: diasAtraso,
    };
  }).sort((a, b) => b.dias_atraso - a.dias_atraso);
}

export function AcordosAbandonadosDialog() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['acordos-abandonados'],
    queryFn: fetchAbandonados,
    refetchOnWindowFocus: false,
  });

  const allChecked = rows.length > 0 && selected.size === rows.length;
  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(rows.map(r => r.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const selectedRows = useMemo(() => rows.filter(r => selected.has(r.id)), [rows, selected]);

  const handleDelete = async () => {
    if (!selectedRows.length) return;
    const ok = window.confirm(
      `Excluir ${selectedRows.length} acordo(s)? A dívida original desses clientes voltará a aparecer no portal.`
    );
    if (!ok) return;
    setDeleting(true);
    try {
      const ids = selectedRows.map(r => r.id);
      const cpfs = Array.from(new Set(selectedRows.map(r => normalizeCpf(r.cliente_cpf)).filter(Boolean)));

      // Deletar em lotes para evitar querystrings enormes
      const chunk = <T,>(arr: T[], n: number) => {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
        return out;
      };

      for (const c of chunk(ids, 100)) {
        const { error } = await supabase.from('pagamentos').delete().in('acordo_id', c);
        if (error) throw error;
      }
      for (const c of chunk(ids, 100)) {
        const { error } = await supabase.from('acordos').delete().in('id', c);
        if (error) throw error;
      }

      // Reativar devedores para cada CPF
      let cpfsReativados = 0;
      for (const cpf of cpfs) {
        const { data: rows, error: selErr } = await supabase
          .from('devedores')
          .select('id, cpf')
          .eq('ativo', false);
        if (selErr) continue;
        const alvo = (rows || []).filter((r: any) => normalizeCpf(r.cpf) === cpf).map((r: any) => r.id);
        if (!alvo.length) continue;
        const { error: updErr } = await supabase
          .from('devedores')
          .update({ ativo: true })
          .in('id', alvo);
        if (!updErr) cpfsReativados++;
      }

      toast({
        title: 'Acordos excluídos',
        description: `${ids.length} acordo(s) excluído(s). Dívida original reativada para ${cpfsReativados} CPF(s).`,
      });
      setSelected(new Set());
      await refetch();
      qc.invalidateQueries();
    } catch (e: any) {
      toast({
        title: 'Erro ao excluir',
        description: e?.message || 'Falha ao excluir acordos',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) refetch(); if (!v) setSelected(new Set()); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          Acordos abandonados
          {rows.length > 0 && (
            <Badge variant="destructive" className="ml-1">{rows.length}</Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Acordos abandonados (10+ dias sem pagamento)</DialogTitle>
          <DialogDescription>
            Acordos ativos sem nenhuma parcela paga cuja 1ª parcela venceu há mais de 10 dias.
            Ao excluir, a dívida original volta a aparecer no portal de consulta por CPF.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto border rounded-md">
          {isLoading ? (
            <div className="p-6 text-center text-muted-foreground">Carregando…</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              Nenhum acordo abandonado encontrado.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr className="text-left">
                  <th className="p-2 w-10">
                    <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
                  </th>
                  <th className="p-2">Cliente</th>
                  <th className="p-2">CPF</th>
                  <th className="p-2">Funcionário</th>
                  <th className="p-2">Criado em</th>
                  <th className="p-2">1ª parcela</th>
                  <th className="p-2">Atraso</th>
                  <th className="p-2 text-right">Valor</th>
                  <th className="p-2 text-center">Parc.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-t hover:bg-muted/50">
                    <td className="p-2">
                      <Checkbox
                        checked={selected.has(r.id)}
                        onCheckedChange={() => toggleOne(r.id)}
                      />
                    </td>
                    <td className="p-2 font-medium">{r.cliente_nome}</td>
                    <td className="p-2 font-mono text-xs">{r.cliente_cpf || '—'}</td>
                    <td className="p-2">{r.funcionario_nome}</td>
                    <td className="p-2">{formatarData(r.criado_em)}</td>
                    <td className="p-2">{formatarData(r.primeira_parcela)}</td>
                    <td className="p-2">
                      <Badge variant="destructive">{r.dias_atraso}d</Badge>
                    </td>
                    <td className="p-2 text-right">{formatarMoeda(r.valor_total)}</td>
                    <td className="p-2 text-center">{r.parcelas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter className="gap-2 items-center">
          <div className="text-sm text-muted-foreground mr-auto">
            {selected.size} de {rows.length} selecionado(s)
          </div>
          <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
          <Button
            variant="destructive"
            disabled={!selected.size || deleting}
            onClick={handleDelete}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? 'Excluindo…' : `Excluir selecionados (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
