import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Candidata {
  id: string;
  nome: string;
  display_phone: string;
  saude_tier: string;
  saude_quality: string;
  enviadas_ontem: number;
  inbound_ontem: number;
  ratio_pct: number;
  cota_tier: number;
  uso_pct: number;
}

function cotaFromTier(tier: string | null): number {
  const t = String(tier || '').toUpperCase();
  if (t.includes('UNLIMITED')) return 999999;
  if (t.includes('100K')) return 100000;
  if (t.includes('10K')) return 10000;
  if (t.includes('1K')) return 1000;
  if (t.includes('250')) return 250;
  return 250;
}

export function RampupTierAvisoCard() {
  const [candidatas, setCandidatas] = useState<Candidata[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const anteontem = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

      const { data: insts } = await (supabase as any)
        .from('meta_whatsapp_instances')
        .select('id, nome, display_phone, saude_tier, saude_quality, ativo, estado_pool')
        .eq('ativo', true);

      const ids = (insts || []).map((i: any) => i.id);
      if (!ids.length) { setLoading(false); return; }

      const { data: metricas } = await (supabase as any)
        .from('meta_instance_daily_metrics')
        .select('instancia_id, data, enviadas, inbound')
        .in('instancia_id', ids)
        .in('data', [ontem, anteontem]);

      const porInst = new Map<string, any>();
      (metricas || []).forEach((m: any) => {
        const cur = porInst.get(m.instancia_id) || { d1: 0, d2: 0, in1: 0, in2: 0 };
        if (m.data === ontem) { cur.d1 = m.enviadas; cur.in1 = m.inbound; }
        else { cur.d2 = m.enviadas; cur.in2 = m.inbound; }
        porInst.set(m.instancia_id, cur);
      });

      const result: Candidata[] = [];
      for (const inst of insts || []) {
        if (String(inst.saude_quality || '').toUpperCase() !== 'GREEN') continue;
        if (inst.estado_pool && inst.estado_pool !== 'ativo') continue;
        const m = porInst.get(inst.id);
        if (!m) continue;
        const cota = cotaFromTier(inst.saude_tier);
        const usoPct1 = m.d1 / cota * 100;
        const usoPct2 = m.d2 / cota * 100;
        const ratio1 = m.d1 > 0 ? (m.in1 / m.d1) * 100 : 0;
        // Critério: 2 dias seguidos ≥ 50% da cota + ratio inbound ≥ 5%
        if (usoPct1 >= 50 && usoPct2 >= 50 && ratio1 >= 5) {
          result.push({
            id: inst.id,
            nome: inst.nome || inst.display_phone,
            display_phone: inst.display_phone,
            saude_tier: inst.saude_tier,
            saude_quality: inst.saude_quality,
            enviadas_ontem: m.d1,
            inbound_ontem: m.in1,
            ratio_pct: ratio1,
            cota_tier: cota,
            uso_pct: Math.round(usoPct1),
          });
        }
      }
      setCandidatas(result);
      setLoading(false);
    })();
  }, []);

  if (loading) return null;
  if (!candidatas.length) return null;

  return (
    <Card className="border-emerald-500/40 bg-emerald-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-emerald-500">
          <TrendingUp className="h-5 w-5" />
          Prontos pra subir de TIER
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Esses números devem subir de tier automaticamente pela Meta nas próximas 24–48h. Não faça nada — mantenha volume constante.
        </p>
        {candidatas.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-md border bg-background p-3">
            <div>
              <div className="font-medium">{c.nome}</div>
              <div className="text-xs text-muted-foreground">
                {c.enviadas_ontem} enviadas · {c.inbound_ontem} recebidas ({c.ratio_pct.toFixed(1)}%) · {c.uso_pct}% da cota
              </div>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="border-emerald-500 text-emerald-500">{c.saude_tier}</Badge>
              <Badge variant="outline" className="border-emerald-500 text-emerald-500">GREEN</Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
