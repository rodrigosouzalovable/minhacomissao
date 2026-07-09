import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Lock, PiggyBank, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, startOfMonth, endOfMonth, getDate, lastDayOfMonth, isAfter, isBefore } from 'date-fns';
import { cn } from '@/lib/utils';

const PREMIO = 50;
const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function janelaSemana(n: 1 | 2 | 3 | 4, ref: Date): { ini: Date; fim: Date } {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const ultimo = lastDayOfMonth(ref).getDate();
  const mapa: Record<number, [number, number]> = {
    1: [1, 7],
    2: [8, 14],
    3: [15, 21],
    4: [22, ultimo],
  };
  const [iniD, fimD] = mapa[n];
  return { ini: new Date(y, m, iniD), fim: new Date(y, m, fimD, 23, 59, 59) };
}

interface Props {
  valorMeta: number;
}

export function MetaSemanalCard({ valorMeta }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const now = new Date();
  const mesAno = format(now, 'yyyy-MM');
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const confeteRef = useRef<Set<number>>(new Set());

  const metaSemana = valorMeta / 4;

  const { data: pagamentos } = useQuery({
    queryKey: ['meta-semanal-pag', user?.id, mesAno],
    queryFn: async () => {
      const { data: acordos } = await supabase.from('acordos').select('id').eq('user_id', user!.id);
      if (!acordos?.length) return [];
      const { data } = await supabase
        .from('pagamentos')
        .select('valor_parcela, data_paga')
        .in('acordo_id', acordos.map(a => a.id))
        .eq('status', 'pago')
        .gte('data_paga', format(monthStart, 'yyyy-MM-dd'))
        .lte('data_paga', format(monthEnd, 'yyyy-MM-dd'));
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: premios } = useQuery({
    queryKey: ['premios-semanais', user?.id, mesAno],
    queryFn: async () => {
      const { data } = await supabase
        .from('premios_semanais' as any)
        .select('semana, status')
        .eq('user_id', user!.id)
        .eq('mes_ano', mesAno);
      return (data as any[]) || [];
    },
    enabled: !!user?.id,
  });

  const semanas = useMemo(() => {
    return ([1, 2, 3, 4] as const).map(n => {
      const { ini, fim } = janelaSemana(n, now);
      const recebido = (pagamentos || [])
        .filter(p => {
          const d = new Date(p.data_paga + 'T12:00:00');
          return d >= ini && d <= fim;
        })
        .reduce((s, p) => s + Number(p.valor_parcela), 0);
      const status: 'futura' | 'corrente' | 'batida' | 'nao_batida' =
        isAfter(ini, now) ? 'futura'
          : recebido >= metaSemana ? 'batida'
            : isBefore(fim, now) ? 'nao_batida'
              : 'corrente';
      return { n, ini, fim, recebido, status };
    });
  }, [pagamentos, metaSemana, now.toDateString()]);

  // Persistir prêmio + confete quando bate semana (uma vez)
  useEffect(() => {
    if (!user || metaSemana <= 0) return;
    semanas.forEach(async s => {
      if (s.status !== 'batida') return;
      const jaSalvo = premios?.some(p => p.semana === s.n);
      const localKey = `semana-batida-${mesAno}-${s.n}-${user.id}`;
      const jaConfete = localStorage.getItem(localKey);

      if (!jaSalvo) {
        await supabase.from('premios_semanais' as any).insert({
          user_id: user.id,
          mes_ano: mesAno,
          semana: s.n,
          valor: PREMIO,
        }).then(() => qc.invalidateQueries({ queryKey: ['premios-semanais', user.id, mesAno] }));
      }

      if (!jaConfete && !confeteRef.current.has(s.n)) {
        confeteRef.current.add(s.n);
        localStorage.setItem(localKey, '1');
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.7 },
          colors: ['#fbbf24', '#10b981', '#3b82f6'],
        });
      }
    });
  }, [semanas, premios, user, mesAno, metaSemana, qc]);

  if (valorMeta <= 0) return null;

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-emerald-600" />
            <h3 className="font-bold">Metas Semanais — R$ {PREMIO} de prêmio por semana</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Meta da semana: <span className="font-semibold text-foreground">{fmt(metaSemana)}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {semanas.map(s => {
            const pct = Math.min((s.recebido / metaSemana) * 100, 100);
            const falta = Math.max(metaSemana - s.recebido, 0);
            return (
              <div
                key={s.n}
                className={cn(
                  'rounded-xl border-2 p-3 transition-all',
                  s.status === 'batida' && 'bg-gradient-to-br from-amber-100 to-yellow-200 border-yellow-400 shadow-md animate-pulse',
                  s.status === 'corrente' && 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/30',
                  s.status === 'futura' && 'bg-muted border-border opacity-70',
                  s.status === 'nao_batida' && 'bg-muted border-border opacity-60'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold">Semana {s.n}</p>
                  {s.status === 'futura' && <Lock className="h-4 w-4 text-muted-foreground" />}
                  {s.status === 'batida' && <CheckCircle2 className="h-5 w-5 text-emerald-700" />}
                  {s.status === 'nao_batida' && <XCircle className="h-4 w-4 text-muted-foreground" />}
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                  Dias {getDate(s.ini)}–{getDate(s.fim)}
                </p>
                {s.status === 'futura' ? (
                  <p className="text-xs italic text-muted-foreground mt-2">Aguardando…</p>
                ) : s.status === 'batida' ? (
                  <div>
                    <p className="text-sm font-bold text-emerald-700">{fmt(s.recebido)}</p>
                    <div className="mt-2 bg-yellow-500 text-white text-[11px] font-bold rounded-full px-2 py-1 text-center">
                      💰 R$ {PREMIO} LIBERADO
                    </div>
                  </div>
                ) : s.status === 'nao_batida' ? (
                  <div>
                    <p className="text-sm font-semibold">{fmt(s.recebido)}</p>
                    <p className="text-[11px] text-muted-foreground mt-2">Não bateu</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold">{fmt(s.recebido)}</p>
                    <Progress value={pct} className="h-2 mt-2" />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Faltam <span className="font-semibold text-foreground">{fmt(falta)}</span>
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
