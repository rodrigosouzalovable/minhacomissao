import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Megaphone, MessageSquare, UserCheck, Handshake, Wallet, Clock } from 'lucide-react';

type Props = {
  dataFmt: string;
  parcial: boolean;
  syncEm: string | null;
  tentativas: number;
  whatsapp: number;
  cpc: number;
  cpca: number;
  valor: number;
};

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pctNum = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);
const pctTxt = (num: number, den: number) =>
  den > 0 ? `${((num / den) * 100).toFixed(1).replace('.', ',')}%` : '0%';

export function FunilAcionamentosCard({
  dataFmt, parcial, syncEm, tentativas, whatsapp, cpc, cpca, valor,
}: Props) {
  const etapas = [
    { label: 'Acionamentos', valor: tentativas, base: tentativas, icon: Megaphone, tone: 'bg-primary' },
    { label: 'WhatsApp (Meta)', valor: whatsapp, base: tentativas, icon: MessageSquare, tone: 'bg-primary/70' },
    { label: 'Interações (CPC)', valor: cpc, base: tentativas, icon: UserCheck, tone: 'bg-accent' },
    { label: 'CPC-A', valor: cpca, base: tentativas, icon: Handshake, tone: 'bg-secondary' },
  ];

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant={parcial ? 'secondary' : 'default'}>
              {parcial ? 'PARCIAL' : 'CONSOLIDADO'} — {dataFmt}
            </Badge>
            {syncEm && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                atualizado às {new Date(syncEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-right">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Valor em acordos</p>
              <p className="text-xl font-bold">{brl(valor)}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {etapas.map((e) => {
            const Icon = e.icon;
            return (
              <div key={e.label} className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">{e.label}</span>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold">{e.valor.toLocaleString('pt-BR')}</p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${e.tone}`}
                    style={{ width: `${Math.min(100, pctNum(e.valor, e.base))}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{pctTxt(e.valor, e.base)} do total acionado</p>
              </div>
            );
          })}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Taxa de interação (CPC ÷ acionamentos)</span>
              <span className="font-semibold">{pctTxt(cpc, tentativas)}</span>
            </div>
            <Progress value={pctNum(cpc, tentativas)} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Taxa de conversão (CPC-A ÷ CPC)</span>
              <span className="font-semibold">{pctTxt(cpca, cpc)}</span>
            </div>
            <Progress value={pctNum(cpca, cpc)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
