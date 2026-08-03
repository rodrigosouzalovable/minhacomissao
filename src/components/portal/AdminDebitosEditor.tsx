import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, Save, Trash2, Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface DebitoEditavel {
  id: string;
  nome: string;
  cpf: string;
  valor_original: number;
  valor_atualizado: number;
  descricao: string | null;
  contrato: string | null;
  data_vencimento: string | null;
  credor: string | null;
}

interface Props {
  debitos: DebitoEditavel[];
  userId: string | null;
  onChanged: () => void | Promise<void>;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function AdminDebitosEditor({ debitos, userId, onChanged }: Props) {
  const { toast } = useToast();
  const [aberto, setAberto] = useState(false);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [novo, setNovo] = useState<{ descricao: string; contrato: string; valor: string; vencimento: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { descricao: string; contrato: string; valor: string; vencimento: string }>>({});

  const total = debitos.reduce((acc, d) => acc + Number(d.valor_original || 0), 0);

  const getDraft = (d: DebitoEditavel) =>
    drafts[d.id] ?? {
      descricao: d.descricao ?? '',
      contrato: d.contrato ?? '',
      valor: String(d.valor_original ?? 0),
      vencimento: d.data_vencimento ?? '',
    };

  const setDraft = (id: string, patch: Partial<{ descricao: string; contrato: string; valor: string; vencimento: string }>) => {
    setDrafts(prev => {
      const base = prev[id] ?? getDraft(debitos.find(d => d.id === id)!);
      return { ...prev, [id]: { ...base, ...patch } };
    });
  };

  const registrarEvento = async (devedorId: string, descricao: string) => {
    if (!userId) return;
    await supabase.from('devedor_eventos').insert({
      devedor_id: devedorId,
      tipo: 'ajuste_admin',
      descricao,
      criado_por: userId,
    });
  };

  const salvar = async (d: DebitoEditavel) => {
    const draft = getDraft(d);
    const valorNum = Number(String(draft.valor).replace(',', '.'));
    if (!isFinite(valorNum) || valorNum < 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }
    setSalvandoId(d.id);
    const { error } = await supabase
      .from('devedores')
      .update({
        descricao: draft.descricao || null,
        contrato: draft.contrato || null,
        valor_original: valorNum,
        valor_atualizado: valorNum,
        data_vencimento: draft.vencimento || null,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', d.id);
    setSalvandoId(null);

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    await registrarEvento(
      d.id,
      `Parcela ajustada pelo admin: ${formatCurrency(Number(d.valor_original))} → ${formatCurrency(valorNum)}` +
        (draft.vencimento !== (d.data_vencimento ?? '') ? ` | vencimento ${d.data_vencimento ?? '—'} → ${draft.vencimento || '—'}` : ''),
    );
    toast({ title: 'Parcela atualizada' });
    setDrafts(prev => {
      const next = { ...prev };
      delete next[d.id];
      return next;
    });
    await onChanged();
  };

  const remover = async (d: DebitoEditavel) => {
    setSalvandoId(d.id);
    const { error } = await supabase
      .from('devedores')
      .update({ ativo: false, atualizado_em: new Date().toISOString() })
      .eq('id', d.id);
    setSalvandoId(null);
    if (error) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
      return;
    }
    await registrarEvento(d.id, `Parcela removida da consulta pelo admin (${formatCurrency(Number(d.valor_original))})`);
    toast({ title: 'Parcela removida da consulta' });
    await onChanged();
  };

  const adicionar = async () => {
    if (!novo || debitos.length === 0) return;
    const ref = debitos[0];
    const valorNum = Number(String(novo.valor).replace(',', '.'));
    if (!isFinite(valorNum) || valorNum <= 0) {
      toast({ title: 'Informe um valor válido', variant: 'destructive' });
      return;
    }
    setSalvandoId('novo');
    const { data, error } = await supabase
      .from('devedores')
      .insert({
        cpf: ref.cpf,
        nome: ref.nome,
        credor: ref.credor,
        contrato: novo.contrato || ref.contrato,
        descricao: novo.descricao || null,
        valor_original: valorNum,
        valor_atualizado: valorNum,
        data_vencimento: novo.vencimento || null,
        ativo: true,
        importado_por: userId,
      })
      .select('id')
      .maybeSingle();
    setSalvandoId(null);
    if (error) {
      toast({ title: 'Erro ao adicionar', description: error.message, variant: 'destructive' });
      return;
    }
    if (data?.id) {
      await registrarEvento(data.id, `Parcela adicionada manualmente pelo admin (${formatCurrency(valorNum)})`);
    }
    toast({ title: 'Parcela adicionada' });
    setNovo(null);
    await onChanged();
  };

  return (
    <Card className="border-0 mb-4" style={{ background: '#f59e0b10', border: '1px solid #f59e0b44' }}>
      <CardContent className="p-3">
        <button
          onClick={() => setAberto(v => !v)}
          className="w-full flex items-center justify-between gap-2"
        >
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: '#f59e0b' }}>
            <ShieldCheck className="h-4 w-4" />
            Modo admin — corrigir débitos
          </span>
          <span className="text-xs font-semibold" style={{ color: '#ffffffaa' }}>
            {debitos.length} parcela(s) · {formatCurrency(total)}
          </span>
        </button>

        {aberto && (
          <div className="mt-3 space-y-2">
            {debitos.map(d => {
              const draft = getDraft(d);
              const busy = salvandoId === d.id;
              return (
                <div
                  key={d.id}
                  className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end p-2 rounded-lg"
                  style={{ background: '#ffffff08' }}
                >
                  <div>
                    <label className="text-[10px] uppercase" style={{ color: '#ffffff88' }}>Parcela</label>
                    <Input
                      value={draft.descricao}
                      onChange={e => setDraft(d.id, { descricao: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase" style={{ color: '#ffffff88' }}>Contrato</label>
                    <Input
                      value={draft.contrato}
                      onChange={e => setDraft(d.id, { contrato: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase" style={{ color: '#ffffff88' }}>Valor (R$)</label>
                    <Input
                      inputMode="decimal"
                      value={draft.valor}
                      onChange={e => setDraft(d.id, { valor: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase" style={{ color: '#ffffff88' }}>Vencimento</label>
                    <Input
                      type="date"
                      value={draft.vencimento}
                      onChange={e => setDraft(d.id, { vencimento: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-9 flex-1" disabled={busy} onClick={() => salvar(d)}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-9"
                      disabled={busy}
                      onClick={() => remover(d)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {novo ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end p-2 rounded-lg" style={{ background: '#00a86b12' }}>
                <div>
                  <label className="text-[10px] uppercase" style={{ color: '#ffffff88' }}>Parcela</label>
                  <Input value={novo.descricao} onChange={e => setNovo({ ...novo, descricao: e.target.value })} className="h-9 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] uppercase" style={{ color: '#ffffff88' }}>Contrato</label>
                  <Input value={novo.contrato} onChange={e => setNovo({ ...novo, contrato: e.target.value })} className="h-9 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] uppercase" style={{ color: '#ffffff88' }}>Valor (R$)</label>
                  <Input inputMode="decimal" value={novo.valor} onChange={e => setNovo({ ...novo, valor: e.target.value })} className="h-9 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] uppercase" style={{ color: '#ffffff88' }}>Vencimento</label>
                  <Input type="date" value={novo.vencimento} onChange={e => setNovo({ ...novo, vencimento: e.target.value })} className="h-9 text-sm" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-9 flex-1" disabled={salvandoId === 'novo'} onClick={adicionar}>
                    {salvandoId === 'novo' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Adicionar'}
                  </Button>
                  <Button size="sm" variant="secondary" className="h-9" onClick={() => setNovo(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                className="h-9"
                onClick={() => setNovo({ descricao: '', contrato: debitos[0]?.contrato ?? '', valor: '', vencimento: '' })}
              >
                <Plus className="h-4 w-4 mr-1" /> Adicionar parcela
              </Button>
            )}

            <p className="text-[11px]" style={{ color: '#ffffff77' }}>
              Remover não apaga o histórico — apenas oculta a parcela da consulta. Todas as alterações são registradas.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
