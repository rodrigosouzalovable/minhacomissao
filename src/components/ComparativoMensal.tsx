import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatarMoeda } from '@/lib/comissao';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';

interface ComparativoData {
  acordosCriados: number;
  acordosCriadosAnterior: number;
  valorAcordos: number;
  valorAcordosAnterior: number;
  pagamentosRecebidos: number;
  pagamentosRecebidosAnterior: number;
  valorRecebido: number;
  valorRecebidoAnterior: number;
}

interface Props {
  data: ComparativoData;
  diaAtual: number;
}

function calcVariacao(atual: number, anterior: number) {
  if (anterior === 0 && atual === 0) return { pct: 0, tipo: 'igual' as const };
  if (anterior === 0) return { pct: 100, tipo: 'subiu' as const };
  const pct = ((atual - anterior) / anterior) * 100;
  if (Math.abs(pct) < 0.5) return { pct: 0, tipo: 'igual' as const };
  return { pct: Math.round(pct * 10) / 10, tipo: pct > 0 ? 'subiu' as const : 'caiu' as const };
}

function VariacaoBadge({ atual, anterior }: { atual: number; anterior: number }) {
  const { pct, tipo } = calcVariacao(atual, anterior);
  if (tipo === 'subiu') {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20 gap-1">
        <TrendingUp className="h-3 w-3" />
        +{pct}%
      </Badge>
    );
  }
  if (tipo === 'caiu') {
    return (
      <Badge className="bg-red-500/15 text-red-600 border-red-500/30 hover:bg-red-500/20 gap-1">
        <TrendingDown className="h-3 w-3" />
        {pct}%
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/20 gap-1">
      <Minus className="h-3 w-3" />
      Igual
    </Badge>
  );
}

function MetricaComparativa({
  label,
  atual,
  anterior,
  isCurrency = false,
}: {
  label: string;
  atual: number;
  anterior: number;
  isCurrency?: boolean;
}) {
  const fmt = isCurrency ? formatarMoeda : (v: number) => String(v);
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{fmt(atual)}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Ant: {fmt(anterior)}</span>
        <VariacaoBadge atual={atual} anterior={anterior} />
      </div>
    </div>
  );
}

export function ComparativoMensal({ data, diaAtual }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <BarChart3 className="h-5 w-5 text-muted-foreground" />
        <CardTitle className="text-base">Comparativo com Mês Anterior (até dia {diaAtual})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 grid-cols-2 lg:grid-cols-4">
          <MetricaComparativa
            label="Acordos Criados"
            atual={data.acordosCriados}
            anterior={data.acordosCriadosAnterior}
          />
          <MetricaComparativa
            label="Valor Acordos"
            atual={data.valorAcordos}
            anterior={data.valorAcordosAnterior}
            isCurrency
          />
          <MetricaComparativa
            label="Pgtos Recebidos"
            atual={data.pagamentosRecebidos}
            anterior={data.pagamentosRecebidosAnterior}
          />
          <MetricaComparativa
            label="Valor Recebido"
            atual={data.valorRecebido}
            anterior={data.valorRecebidoAnterior}
            isCurrency
          />
        </div>
      </CardContent>
    </Card>
  );
}
