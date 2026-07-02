import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, AlertTriangle, TrendingUp, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

type Snapshot = {
  waba_id: string;
  dia: string;
  conversation_category: string;
  conversation_type: string | null;
  conversations_count: number;
  cost_usd: number;
  cost_brl: number;
  fx_rate: number;
};

type Alerta = {
  id: string;
  waba_id: string | null;
  tipo: string;
  valor_usd: number | null;
  valor_brl: number | null;
  detalhes: any;
  ocorreu_em: string;
  notificado_em: string | null;
};

export default function MetaBilling() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);

  const load = async () => {
    setLoading(true);
    const [sn, al] = await Promise.all([
      supabase
        .from("meta_billing_snapshot")
        .select("*")
        .order("dia", { ascending: false })
        .limit(1000),
      supabase
        .from("meta_billing_alerts")
        .select("*")
        .order("ocorreu_em", { ascending: false })
        .limit(200),
    ]);
    setSnapshots((sn.data as any) || []);
    setAlertas((al.data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const sync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-billing-sync", {
        body: { days: 35 },
      });
      if (error) throw error;
      if (data?.errors?.length) {
        toast.warning(`Sincronizado com ${data.errors.length} avisos`);
      } else {
        toast.success(`Sincronização concluída (${data?.upserted || 0} registros)`);
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  const totais = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const mesAtual = hoje.slice(0, 7);
    let dia = 0, mes = 0, total = 0;
    const porDia = new Map<string, number>();
    const porCategoria = new Map<string, number>();
    for (const s of snapshots) {
      total += Number(s.cost_brl);
      if (s.dia === hoje) dia += Number(s.cost_brl);
      if (s.dia.startsWith(mesAtual)) mes += Number(s.cost_brl);
      porDia.set(s.dia, (porDia.get(s.dia) || 0) + Number(s.cost_brl));
      porCategoria.set(
        s.conversation_category,
        (porCategoria.get(s.conversation_category) || 0) + Number(s.cost_brl),
      );
    }
    return { dia, mes, total, porDia, porCategoria };
  }, [snapshots]);

  const diasOrdenados = useMemo(
    () => Array.from(totais.porDia.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1)),
    [totais],
  );

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CreditCard className="h-6 w-6" /> Cobranças Meta WhatsApp
            </h1>
            <p className="text-sm text-muted-foreground">
              Custo real cobrado pela Meta por WABA, categoria e dia. Câmbio USD→BRL aplicado no momento da sincronização.
            </p>
          </div>
          <Button onClick={sync} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sincronizar com Meta
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Hoje</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold tabular-nums">{brl(totais.dia)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Este mês</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold tabular-nums">{brl(totais.mes)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Total (últimos 35d)</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold tabular-nums">{brl(totais.total)}</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Alertas recebidos da Meta</CardTitle>
            <CardDescription>Cobranças, falhas de pagamento, thresholds e mudanças de qualidade. Notificação enviada ao WhatsApp admin em tempo real.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> :
              alertas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum alerta recebido ainda. Após configurar o webhook com os campos <code>account_alerts</code>, <code>account_update</code> e <code>phone_number_quality_update</code> na Meta, os eventos passam a chegar aqui automaticamente.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>WABA</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alertas.map(a => (
                      <TableRow key={a.id}>
                        <TableCell>{new Date(a.ocorreu_em).toLocaleString("pt-BR")}</TableCell>
                        <TableCell><Badge variant="secondary">{a.tipo}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{a.waba_id || "-"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {a.valor_brl ? brl(a.valor_brl) : "-"}
                          {a.valor_usd ? <span className="text-xs text-muted-foreground ml-2">US$ {a.valor_usd.toFixed(2)}</span> : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Custo diário (últimos dias)</CardTitle>
            <CardDescription>Investigar 30/06? Procure o dia na lista abaixo — clique para expandir por categoria.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : diasOrdenados.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum dado ainda. Clique em "Sincronizar com Meta" para puxar os últimos 35 dias.</p>
            ) : (
              <div className="space-y-2">
                {diasOrdenados.slice(0, 40).map(([dia, valor]) => {
                  const snapsDoDia = snapshots.filter(s => s.dia === dia);
                  return (
                    <details key={dia} className="border rounded-md">
                      <summary className="p-3 flex justify-between items-center cursor-pointer hover:bg-muted/50">
                        <span className="font-medium">{new Date(dia + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
                        <span className="tabular-nums font-bold">{brl(valor)}</span>
                      </summary>
                      <div className="p-3 border-t bg-muted/20 space-y-1 text-sm">
                        {snapsDoDia.map((s, i) => (
                          <div key={i} className="flex justify-between">
                            <span>
                              <Badge variant="outline" className="mr-2">{s.conversation_category}</Badge>
                              {s.conversation_type || ""} — {s.conversations_count} conversas
                              <span className="text-xs text-muted-foreground ml-2 font-mono">{s.waba_id.slice(-6)}</span>
                            </span>
                            <span className="tabular-nums">{brl(Number(s.cost_brl))} <span className="text-xs text-muted-foreground">US$ {Number(s.cost_usd).toFixed(2)}</span></span>
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
