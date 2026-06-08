import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isAfter, parseISO, differenceInCalendarDays } from 'date-fns';
import { Flame, Trophy, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const MEDALHAS = [
  { id: 'm25', threshold: 0.25, emoji: '🥉', label: '25% da meta' },
  { id: 'm50', threshold: 0.50, emoji: '🥈', label: '50% da meta' },
  { id: 'm75', threshold: 0.75, emoji: '🥇', label: '75% da meta' },
  { id: 'm90', threshold: 0.90, emoji: '💎', label: '90% da meta' },
  { id: 'm100', threshold: 1.00, emoji: '🏆', label: 'Meta batida!' },
  { id: 'm120', threshold: 1.20, emoji: '⭐', label: 'Overachiever (+20%)' },
];

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function dispararConfete() {
  const end = Date.now() + 2 * 1000;
  const colors = ['#10b981', '#fbbf24', '#3b82f6', '#ec4899'];
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

interface Props {
  recebido: number;
  meta: number;
  projecao: number;
}

export function MotivacaoCard({ recebido, meta, projecao }: Props) {
  const { user } = useAuth();
  const fired = useRef(false);
  const now = new Date();
  const mesAno = format(now, 'yyyy-MM');
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const pct = meta > 0 ? recebido / meta : 0;

  // Confete ao bater meta (1x por mês/user)
  useEffect(() => {
    if (!user || meta <= 0 || recebido < meta || fired.current) return;
    const key = `meta-confete-${mesAno}-${user.id}`;
    if (localStorage.getItem(key)) return;
    fired.current = true;
    localStorage.setItem(key, '1');
    dispararConfete();
  }, [recebido, meta, user, mesAno]);

  // Streak de dias úteis com pagamento
  const { data: streak = 0 } = useQuery({
    queryKey: ['motivacao-streak', user?.id, mesAno],
    queryFn: async () => {
      const { data: acordos } = await supabase.from('acordos').select('id').eq('user_id', user!.id);
      if (!acordos?.length) return 0;
      const { data } = await supabase
        .from('pagamentos')
        .select('data_paga')
        .in('acordo_id', acordos.map(a => a.id))
        .eq('status', 'pago')
        .gte('data_paga', format(monthStart, 'yyyy-MM-dd'))
        .lte('data_paga', format(monthEnd, 'yyyy-MM-dd'))
        .order('data_paga', { ascending: false });
      const dias = new Set((data || []).map(p => p.data_paga));
      let count = 0;
      let cursor = new Date(now);
      while (true) {
        if (isWeekend(cursor)) { cursor.setDate(cursor.getDate() - 1); continue; }
        if (isAfter(cursor, now)) { cursor.setDate(cursor.getDate() - 1); continue; }
        const k = format(cursor, 'yyyy-MM-dd');
        if (dias.has(k)) {
          count++;
          cursor.setDate(cursor.getDate() - 1);
        } else break;
      }
      return count;
    },
    enabled: !!user?.id,
    refetchInterval: 5 * 60 * 1000,
  });

  const mensagem = useMemo(() => {
    if (meta <= 0) return null;
    if (recebido >= meta * 1.2) return { emoji: '🚀', text: 'INCRÍVEL! Você está voando — mais de 20% acima da meta!', tone: 'from-amber-400 to-orange-500' };
    if (recebido >= meta) return { emoji: '🏆', text: 'META BATIDA! Parabéns, você é fera! Continue construindo o resultado.', tone: 'from-emerald-400 to-green-600' };
    if (projecao >= meta) return { emoji: '📈', text: 'Sua projeção indica que vai bater a meta! Mantém o foco.', tone: 'from-blue-400 to-emerald-500' };
    if (pct >= 0.75) return { emoji: '🎯', text: 'Quase lá! Falta pouquíssimo para bater a meta.', tone: 'from-yellow-400 to-emerald-500' };
    if (pct >= 0.50) return { emoji: '🔥', text: 'Mais da metade conquistada! Continua nesse ritmo.', tone: 'from-orange-400 to-yellow-500' };
    if (pct >= 0.25) return { emoji: '💪', text: 'Você já está construindo o resultado. Bora pra cima!', tone: 'from-purple-400 to-pink-500' };
    return { emoji: '🚀', text: 'Bora começar forte! Cada acordo conta.', tone: 'from-indigo-400 to-purple-500' };
  }, [pct, recebido, meta, projecao]);

  const proximaMedalha = MEDALHAS.find(m => pct < m.threshold);
  const faltaProx = proximaMedalha ? Math.max(meta * proximaMedalha.threshold - recebido, 0) : 0;

  if (meta <= 0 || !mensagem) return null;

  return (
    <TooltipProvider>
      <Card className="overflow-hidden border-0 shadow-md">
        <div className={cn('p-5 text-white bg-gradient-to-r', mensagem.tone)}>
          <div className="flex items-center gap-4">
            <div className="text-5xl animate-bounce-slow">{mensagem.emoji}</div>
            <div className="flex-1">
              <p className="text-lg font-bold leading-tight">{mensagem.text}</p>
              {proximaMedalha && recebido < meta && (
                <p className="text-sm opacity-90 mt-1">
                  Faltam <span className="font-bold">{fmt(faltaProx)}</span> para desbloquear {proximaMedalha.emoji} {proximaMedalha.label}
                </p>
              )}
            </div>
            {streak >= 2 && (
              <div className="flex items-center gap-1 bg-white/20 backdrop-blur px-3 py-2 rounded-full text-sm font-bold">
                <Flame className="h-4 w-4" />
                {streak} {streak === 1 ? 'dia' : 'dias'}
              </div>
            )}
          </div>
        </div>

        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Conquistas do mês
            </p>
            <p className="text-xs text-muted-foreground">{MEDALHAS.filter(m => pct >= m.threshold).length} / {MEDALHAS.length}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {MEDALHAS.map(m => {
              const unlocked = pct >= m.threshold;
              return (
                <Tooltip key={m.id}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        'h-12 w-12 rounded-full flex items-center justify-center text-2xl border-2 transition-all',
                        unlocked
                          ? 'bg-gradient-to-br from-amber-100 to-amber-300 border-amber-400 shadow-md scale-100 hover:scale-110'
                          : 'bg-muted border-border grayscale opacity-40'
                      )}
                    >
                      {m.emoji}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs font-medium">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{unlocked ? '✓ Desbloqueado' : `${(m.threshold * 100).toFixed(0)}% da meta`}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
