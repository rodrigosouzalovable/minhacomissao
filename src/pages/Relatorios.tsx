import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { Plus, RotateCcw, Download, CalendarIcon, Trophy, Pencil } from 'lucide-react';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ImportarLigacoesDialog } from '@/components/relatorios/ImportarLigacoesDialog';

const HORAS = [
  '8h-9h', '9h-10h', '10h-11h', '11h-12h', '12h-13h', '13h-14h',
  '14h-15h', '15h-16h', '16h-17h', '17h-18h', '18h-19h',
];

type Linha = {
  id?: string;
  data: string;
  hora: string;
  tentativas: number;
  whatsapp: number;
  alo: number;
  cpc: number;
  cpca: number;
  acordos_valor: number;
};

type ColunaIncr = 'tentativas' | 'whatsapp' | 'alo' | 'cpc' | 'cpca';

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtPct = (num: number, den: number) =>
  den === 0 ? '0%' : `${((num / den) * 100).toFixed(2).replace('.', ',')}%`;

function toDateStr(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

export default function Relatorios() {
  const { isAdmin } = useUserRole();
  const [data, setData] = useState<Date>(new Date());
  const [linhas, setLinhas] = useState<Record<string, Linha>>({});
  const [meta, setMeta] = useState<number>(0);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaInput, setMetaInput] = useState('');
  const [editingValor, setEditingValor] = useState<string | null>(null);
  const [valorInput, setValorInput] = useState('');
  const [editingCol, setEditingCol] = useState<{ hora: string; col: ColunaIncr } | null>(null);
  const [colInput, setColInput] = useState('');
  const cooldownRef = useRef<Record<string, number>>({});

  const dataStr = toDateStr(data);

  const load = useCallback(async () => {
    const [rRes, mRes] = await Promise.all([
      supabase.from('relatorio_acionamentos' as any).select('*').eq('data', dataStr),
      supabase.from('relatorio_acionamentos_meta' as any).select('meta_valor').eq('data', dataStr).maybeSingle(),
    ]);
    const map: Record<string, Linha> = {};
    HORAS.forEach(h => {
      map[h] = { data: dataStr, hora: h, tentativas: 0, whatsapp: 0, alo: 0, cpc: 0, cpca: 0, acordos_valor: 0 };
    });
    (rRes.data as any[] | null)?.forEach(r => {
      if (map[r.hora]) {
        map[r.hora] = {
          id: r.id, data: r.data, hora: r.hora,
          tentativas: r.tentativas, whatsapp: r.whatsapp ?? 0, alo: r.alo, cpc: r.cpc, cpca: r.cpca,
          acordos_valor: Number(r.acordos_valor),
        };
      }
    });
    setLinhas(map);
    setMeta(Number((mRes.data as any)?.meta_valor ?? 0));
  }, [dataStr]);

  useEffect(() => { load(); }, [load]);

  // Realtime — só para o dia selecionado
  useEffect(() => {
    const ch = supabase
      .channel('relatorio-acionamentos-' + dataStr)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'relatorio_acionamentos', filter: `data=eq.${dataStr}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [dataStr, load]);

  const incrementar = async (hora: string, coluna: ColunaIncr) => {
    const key = `${hora}-${coluna}`;
    const now = Date.now();
    if (cooldownRef.current[key] && now - cooldownRef.current[key] < 2000) {
      toast.warning('Aguarde 2 segundos entre cliques');
      return;
    }
    cooldownRef.current[key] = now;

    // Otimista
    setLinhas(prev => ({
      ...prev,
      [hora]: { ...prev[hora], [coluna]: (prev[hora][coluna] as number) + 1 },
    }));

    const { error } = await supabase.rpc('incrementar_metrica_acionamento' as any, {
      p_data: dataStr, p_hora: hora, p_coluna: coluna,
    });
    if (error) {
      toast.error(error.message);
      load();
    }
  };

  const totais = useMemo(() => {
    const arr = HORAS.map(h => linhas[h]).filter(Boolean);
    return {
      tentativas: arr.reduce((s, l) => s + l.tentativas, 0),
      whatsapp: arr.reduce((s, l) => s + l.whatsapp, 0),
      alo: arr.reduce((s, l) => s + l.alo, 0),
      cpc: arr.reduce((s, l) => s + l.cpc, 0),
      cpca: arr.reduce((s, l) => s + l.cpca, 0),
      valor: arr.reduce((s, l) => s + l.acordos_valor, 0),
    };
  }, [linhas]);

  const medias = useMemo(() => {
    const arr = HORAS.map(h => linhas[h]).filter(Boolean);
    const pctAlos = arr.filter(l => l.tentativas > 0).map(l => (l.alo / l.tentativas) * 100);
    const pctCpcs = arr.filter(l => l.alo > 0).map(l => (l.cpc / l.alo) * 100);
    const pctConvs = arr.filter(l => l.cpc > 0).map(l => (l.cpca / l.cpc) * 100);
    const avg = (a: number[]) => a.length === 0 ? 0 : a.reduce((s, v) => s + v, 0) / a.length;
    return {
      alo: avg(pctAlos), cpc: avg(pctCpcs), conv: avg(pctConvs),
      vazio: { alo: pctAlos.length === 0, cpc: pctCpcs.length === 0, conv: pctConvs.length === 0 },
    };
  }, [linhas]);

  const horaTop = useMemo(() => {
    let top = '';
    let max = 0;
    HORAS.forEach(h => {
      const v = linhas[h]?.acordos_valor ?? 0;
      if (v > max) { max = v; top = h; }
    });
    return top;
  }, [linhas]);

  const pctMeta = meta > 0 ? Math.min(100, (totais.valor / meta) * 100) : 0;

  const resetarDia = async () => {
    if (!isAdmin) return;
    const { error } = await supabase
      .from('relatorio_acionamentos' as any)
      .delete()
      .eq('data', dataStr);
    if (error) { toast.error(error.message); return; }
    await supabase.from('relatorio_acionamentos_log' as any).insert({
      acao: 'reset_dia', data: dataStr,
    } as any);
    toast.success('Dia resetado');
    load();
  };

  const salvarMeta = async () => {
    const v = Number(metaInput.replace(',', '.')) || 0;
    const { error } = await supabase
      .from('relatorio_acionamentos_meta' as any)
      .upsert({ data: dataStr, meta_valor: v } as any, { onConflict: 'data' });
    if (error) { toast.error(error.message); return; }
    setMeta(v);
    setEditingMeta(false);
    toast.success('Meta atualizada');
  };

  const salvarValor = async (hora: string) => {
    const v = Number(valorInput.replace(',', '.')) || 0;
    const { error } = await supabase
      .from('relatorio_acionamentos' as any)
      .upsert({ data: dataStr, hora, acordos_valor: v } as any, { onConflict: 'data,hora' });
    if (error) { toast.error(error.message); return; }
    await supabase.from('relatorio_acionamentos_log' as any).insert({
      acao: 'edicao_acordos_valor', data: dataStr, hora,
      valor_anterior: linhas[hora]?.acordos_valor ?? 0, valor_novo: v,
    } as any);
    setEditingValor(null);
    load();
  };

  const salvarColuna = async (hora: string, col: ColunaIncr) => {
    const v = Math.max(0, Math.floor(Number(colInput.replace(',', '.')) || 0));
    const anterior = (linhas[hora]?.[col] as number) ?? 0;
    const { error } = await supabase
      .from('relatorio_acionamentos' as any)
      .upsert({ data: dataStr, hora, [col]: v } as any, { onConflict: 'data,hora' });
    if (error) { toast.error(error.message); return; }
    await supabase.from('relatorio_acionamentos_log' as any).insert({
      acao: 'edicao_' + col, data: dataStr, hora,
      valor_anterior: anterior, valor_novo: v,
    } as any);
    setEditingCol(null);
    toast.success('Valor atualizado');
    load();
  };


  const exportCSV = () => {
    const rows = [
      ['HORA','TENTATIVAS','WHATSAPP','ALO','CPC','CPC-A','$ ACORDOS','% ALO','% CPC','% CONVERSAO'],
      ...HORAS.map(h => {
        const l = linhas[h];
        return [
          h, l.tentativas, l.whatsapp, l.alo, l.cpc, l.cpca,
          l.acordos_valor.toFixed(2).replace('.', ','),
          fmtPct(l.alo, l.tentativas),
          fmtPct(l.cpc, l.alo),
          fmtPct(l.cpca, l.cpc),
        ];
      }),
      ['TOTAL', totais.tentativas, totais.whatsapp, totais.alo, totais.cpc, totais.cpca, totais.valor.toFixed(2).replace('.', ','), '--','--','--'],
      ['MÉDIA','--','--','--','--','--','--',
        medias.vazio.alo ? '0%' : medias.alo.toFixed(2).replace('.', ',') + '%',
        medias.vazio.cpc ? '0%' : medias.cpc.toFixed(2).replace('.', ',') + '%',
        medias.vazio.conv ? '0%' : medias.conv.toFixed(2).replace('.', ',') + '%',
      ],
    ];
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-acionamentos-${dataStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chartData = HORAS.map(h => ({ hora: h, valor: linhas[h]?.acordos_valor ?? 0 }));

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Relatório de Acionamentos — {format(data, "dd/MM/yyyy", { locale: ptBR })}
            </h1>
            <p className="text-sm text-muted-foreground">
              Encerrando o dia, vamos consolidar os resultados com qualidade.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(data, 'dd/MM/yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={data}
                  onSelect={(d) => d && setData(d)}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" /> Exportar CSV
            </Button>
            {isAdmin && <ImportarLigacoesDialog onDone={load} />}
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <RotateCcw className="h-4 w-4 mr-2" /> Resetar dia
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Resetar o dia {format(data, 'dd/MM/yyyy')}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Todos os contadores e valores do dia serão removidos. Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={resetarDia}>Confirmar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Card meta */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Acordos hoje</p>
                <p className="text-2xl font-bold">{fmtBRL(totais.valor)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Meta do dia</p>
                {editingMeta && isAdmin ? (
                  <div className="flex gap-2">
                    <Input
                      type="number" value={metaInput} onChange={(e) => setMetaInput(e.target.value)}
                      className="w-32" autoFocus
                    />
                    <Button size="sm" onClick={salvarMeta}>Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingMeta(false)}>X</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold">{fmtBRL(meta)}</p>
                    {isAdmin && (
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => { setMetaInput(String(meta)); setEditingMeta(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="min-w-[200px]">
                <p className="text-sm text-muted-foreground">
                  {pctMeta.toFixed(2).replace('.', ',')}% atingido
                </p>
                <Progress value={pctMeta} className="mt-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-2">HORA</th>
                  <th className="p-2">TENTATIVAS</th>
                  <th className="p-2">WHATSAPP</th>
                  <th className="p-2">ALO</th>
                  <th className="p-2">CPC</th>
                  <th className="p-2">CPC-A</th>
                  <th className="p-2">$ ACORDOS</th>
                  <th className="p-2">% ALO</th>
                  <th className="p-2">% CPC</th>
                  <th className="p-2">% CONVERSÃO</th>
                </tr>
              </thead>
              <tbody>
                {HORAS.map(h => {
                  const l = linhas[h];
                  if (!l) return null;
                  const isTop = h === horaTop && l.acordos_valor > 0;
                  return (
                    <tr key={h} className="border-b hover:bg-muted/30">
                      <td className="p-2 font-medium">
                        {isTop && <Trophy className="inline h-4 w-4 mr-1 text-yellow-500" />}
                        {h}
                      </td>
                      {(['tentativas','alo','cpc','cpca'] as ColunaIncr[]).map(col => (
                        <td key={col} className="p-2">
                          {editingCol?.hora === h && editingCol?.col === col && isAdmin ? (
                            <div className="flex gap-1">
                              <Input
                                type="number" value={colInput}
                                onChange={(e) => setColInput(e.target.value)}
                                className="w-20 h-7" autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') salvarColuna(h, col);
                                  if (e.key === 'Escape') setEditingCol(null);
                                }}
                              />
                              <Button size="sm" className="h-7" onClick={() => salvarColuna(h, col)}>OK</Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="tabular-nums w-10">{l[col]}</span>
                              <Button
                                size="icon" variant="outline" className="h-6 w-6"
                                onClick={() => incrementar(h, col)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              {isAdmin && (
                                <Button size="icon" variant="ghost" className="h-6 w-6"
                                  onClick={() => { setColInput(String(l[col])); setEditingCol({ hora: h, col }); }}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          )}
                        </td>
                      ))}
                      <td className="p-2">
                        {editingValor === h && isAdmin ? (
                          <div className="flex gap-1">
                            <Input
                              type="number" value={valorInput}
                              onChange={(e) => setValorInput(e.target.value)}
                              className="w-24 h-7" autoFocus
                              onKeyDown={(e) => e.key === 'Enter' && salvarValor(h)}
                            />
                            <Button size="sm" className="h-7" onClick={() => salvarValor(h)}>OK</Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="tabular-nums">{fmtBRL(l.acordos_valor)}</span>
                            {isAdmin && (
                              <Button size="icon" variant="ghost" className="h-6 w-6"
                                onClick={() => { setValorInput(String(l.acordos_valor)); setEditingValor(h); }}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-2 tabular-nums">{fmtPct(l.alo, l.tentativas)}</td>
                      <td className="p-2 tabular-nums">{fmtPct(l.cpc, l.alo)}</td>
                      <td className="p-2 tabular-nums">{fmtPct(l.cpca, l.cpc)}</td>
                    </tr>
                  );
                })}
                <tr className="border-b font-bold bg-muted/40">
                  <td className="p-2">TOTAL</td>
                  <td className="p-2 tabular-nums">{totais.tentativas}</td>
                  <td className="p-2 tabular-nums">{totais.alo}</td>
                  <td className="p-2 tabular-nums">{totais.cpc}</td>
                  <td className="p-2 tabular-nums">{totais.cpca}</td>
                  <td className="p-2 tabular-nums">{fmtBRL(totais.valor)}</td>
                  <td className="p-2">--</td>
                  <td className="p-2">--</td>
                  <td className="p-2">--</td>
                </tr>
                <tr className="font-bold bg-muted/40">
                  <td className="p-2">MÉDIA</td>
                  <td className="p-2">--</td>
                  <td className="p-2">--</td>
                  <td className="p-2">--</td>
                  <td className="p-2">--</td>
                  <td className="p-2">--</td>
                  <td className="p-2 tabular-nums">
                    {medias.vazio.alo ? '0%' : medias.alo.toFixed(2).replace('.', ',') + '%'}
                  </td>
                  <td className="p-2 tabular-nums">
                    {medias.vazio.cpc ? '0%' : medias.cpc.toFixed(2).replace('.', ',') + '%'}
                  </td>
                  <td className="p-2 tabular-nums">
                    {medias.vazio.conv ? '0%' : medias.conv.toFixed(2).replace('.', ',') + '%'}
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Gráfico */}
        <Card>
          <CardHeader><CardTitle>$ Acordos por hora</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="hora" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  formatter={(v: number) => fmtBRL(v)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
