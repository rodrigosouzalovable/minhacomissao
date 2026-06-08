import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { AvatarComMoldura } from './AvatarComMoldura';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function MuralTop3() {
  const { data: visivel } = useQuery({
    queryKey: ['mural-visivel'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes_motivacao' as any)
        .select('mural_top3_visivel')
        .limit(1)
        .maybeSingle();
      return (data as any)?.mural_top3_visivel ?? true;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: ranking } = useQuery({
    queryKey: ['mural-top3'],
    queryFn: async () => {
      const { data } = await supabase.rpc('ranking_mensal' as any);
      const arr = (data as any[]) || [];
      // pegar avatar (profiles.avatar_url se houver)
      const ids = arr.slice(0, 3).map(r => r.user_id);
      if (!ids.length) return [];
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, avatar_url')
        .in('id', ids);
      const map = new Map((profs || []).map((p: any) => [p.id, p.avatar_url]));
      return arr.slice(0, 3).map(r => ({ ...r, avatar_url: map.get(r.user_id) }));
    },
    staleTime: 2 * 60 * 1000,
  });

  if (!visivel || !ranking?.length) return null;

  const podio = [
    { idx: 1, item: ranking[1], height: 'h-32', tier: 'prata' as const, medal: '🥈', from: 'from-slate-200', to: 'to-slate-400' },
    { idx: 0, item: ranking[0], height: 'h-40', tier: 'ouro' as const, medal: '🥇', from: 'from-amber-200', to: 'to-yellow-500' },
    { idx: 2, item: ranking[2], height: 'h-24', tier: 'bronze' as const, medal: '🥉', from: 'from-amber-700/30', to: 'to-amber-900/50' },
  ].filter(p => p.item);

  return (
    <Card className="p-6 bg-gradient-to-br from-background to-muted/40">
      <div className="flex items-center gap-2 mb-4 justify-center">
        <Trophy className="h-5 w-5 text-yellow-500" />
        <h3 className="font-bold text-lg">Mural do Mês — Top 3</h3>
      </div>
      <div className="flex items-end justify-center gap-3 sm:gap-6">
        {podio.map(p => (
          <div key={p.idx} className="flex flex-col items-center gap-2 flex-1 max-w-[160px]">
            <AvatarComMoldura
              src={p.item.avatar_url}
              fallback={p.item.nome || '?'}
              tier={p.tier}
              size="lg"
              showBadge={false}
            />
            <p className="text-sm font-semibold text-center truncate w-full">{p.item.nome}</p>
            <p className="text-xs text-emerald-600 font-bold">{fmt(Number(p.item.total_recebido))}</p>
            <div
              className={cn(
                'w-full rounded-t-lg flex items-start justify-center pt-2 text-3xl bg-gradient-to-b',
                p.from,
                p.to,
                p.height
              )}
            >
              {p.medal}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
