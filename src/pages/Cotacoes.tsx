import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { TrendingDown, TrendingUp, RefreshCw, DollarSign, Euro, Trophy } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const DATA_INICIO = "15/07/2026";

const fmtBRL = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });

const fmtDataBR = (iso: string) => {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

type CotacaoRow = { data: string; usd: number; eur: number };
type MinimaRow = { moeda: string; valor: number; data_registro: string };

export default function Cotacoes() {
  const { isAdmin } = useUserRole();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [atualizando, setAtualizando] = useState(false);

  const { data: historico = [] } = useQuery({
    queryKey: ["cotacoes-historico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotacoes_moedas" as any)
        .select("data, usd, eur")
        .order("data", { ascending: false })
        .limit(180);
      if (error) throw error;
      return (data ?? []) as unknown as CotacaoRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: minimas = [] } = useQuery({
    queryKey: ["cotacoes-minimas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotacoes_minimas" as any)
        .select("moeda, valor, data_registro");
      if (error) throw error;
      return (data ?? []) as unknown as MinimaRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const minUsd = minimas.find((m) => m.moeda === "USD");
  const minEur = minimas.find((m) => m.moeda === "EUR");
  const hoje = historico[0];

  const varPct = (atual?: number, minimo?: number) => {
    if (!atual || !minimo) return null;
    return ((atual - minimo) / minimo) * 100;
  };

  const varUsd = varPct(hoje?.usd, minUsd?.valor);
  const varEur = varPct(hoje?.eur, minEur?.valor);

  const chartData = [...historico]
    .reverse()
    .slice(-30)
    .map((r) => ({
      data: fmtDataBR(r.data).slice(0, 5),
      USD: Number(r.usd),
      EUR: Number(r.eur),
    }));

  const atualizarAgora = async () => {
    setAtualizando(true);
    try {
      const { error } = await supabase.functions.invoke("consultar-cotacao-diaria", {
        body: { forcar: true },
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["cotacoes-historico"] });
      await qc.invalidateQueries({ queryKey: ["cotacoes-minimas"] });
      toast({ title: "Cotação atualizada", description: "Valores sincronizados e enviados." });
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message ?? "Falha ao atualizar", variant: "destructive" });
    } finally {
      setAtualizando(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <DollarSign className="h-8 w-8 text-primary" />
              Cotações
            </h1>
            <p className="text-muted-foreground mt-1">
              Acompanhamento diário de USD e EUR — evento iniciado em {DATA_INICIO}
            </p>
          </div>
          {isAdmin && (
            <Button onClick={atualizarAgora} disabled={atualizando}>
              <RefreshCw className={`h-4 w-4 mr-2 ${atualizando ? "animate-spin" : ""}`} />
              Atualizar cotação agora
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* USD */}
          <Card className="border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/5 to-transparent">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5 text-emerald-500" />
                Dólar (USD)
              </CardTitle>
              <Badge variant="outline">Hoje: {hoje ? fmtDataBR(hoje.data) : "-"}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Valor atual</div>
                <div className="text-4xl font-bold">{fmtBRL(hoje?.usd)}</div>
              </div>
              <div className="rounded-lg border-2 border-amber-400/60 bg-amber-500/10 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase">
                  <Trophy className="h-4 w-4" />
                  Menor valor registrado
                </div>
                <div className="text-2xl font-bold mt-1">{fmtBRL(minUsd?.valor)}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  em {minUsd?.data_registro ? fmtDataBR(minUsd.data_registro) : "-"}
                </div>
              </div>
              {varUsd !== null && (
                <div className="flex items-center gap-2 text-sm">
                  {varUsd > 0 ? (
                    <TrendingUp className="h-4 w-4 text-red-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-emerald-500" />
                  )}
                  <span className={varUsd > 0 ? "text-red-500" : "text-emerald-500"}>
                    {varUsd > 0 ? "+" : ""}
                    {varUsd.toFixed(2)}% vs mínimo
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* EUR */}
          <Card className="border-2 border-blue-500/40 bg-gradient-to-br from-blue-500/5 to-transparent">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Euro className="h-5 w-5 text-blue-500" />
                Euro (EUR)
              </CardTitle>
              <Badge variant="outline">Hoje: {hoje ? fmtDataBR(hoje.data) : "-"}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Valor atual</div>
                <div className="text-4xl font-bold">{fmtBRL(hoje?.eur)}</div>
              </div>
              <div className="rounded-lg border-2 border-amber-400/60 bg-amber-500/10 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase">
                  <Trophy className="h-4 w-4" />
                  Menor valor registrado
                </div>
                <div className="text-2xl font-bold mt-1">{fmtBRL(minEur?.valor)}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  em {minEur?.data_registro ? fmtDataBR(minEur.data_registro) : "-"}
                </div>
              </div>
              {varEur !== null && (
                <div className="flex items-center gap-2 text-sm">
                  {varEur > 0 ? (
                    <TrendingUp className="h-4 w-4 text-red-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-emerald-500" />
                  )}
                  <span className={varEur > 0 ? "text-red-500" : "text-emerald-500"}>
                    {varEur > 0 ? "+" : ""}
                    {varEur.toFixed(2)}% vs mínimo
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Histórico (últimos 30 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="data" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} domain={["auto", "auto"]} />
                    <Tooltip
                      formatter={(v: number) => fmtBRL(v)}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="USD" stroke="hsl(142 76% 36%)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="EUR" stroke="hsl(217 91% 60%)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Histórico completo</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>USD</TableHead>
                  <TableHead>EUR</TableHead>
                  <TableHead className="text-right">Destaque</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historico.map((r) => {
                  const eUsdMin = minUsd && Number(r.usd) === Number(minUsd.valor) && r.data === minUsd.data_registro;
                  const eEurMin = minEur && Number(r.eur) === Number(minEur.valor) && r.data === minEur.data_registro;
                  return (
                    <TableRow key={r.data} className={eUsdMin || eEurMin ? "bg-amber-500/10" : ""}>
                      <TableCell className="font-medium">{fmtDataBR(r.data)}</TableCell>
                      <TableCell>{fmtBRL(r.usd)}</TableCell>
                      <TableCell>{fmtBRL(r.eur)}</TableCell>
                      <TableCell className="text-right">
                        {eUsdMin && (
                          <Badge className="bg-amber-500 hover:bg-amber-600 mr-1">
                            <Trophy className="h-3 w-3 mr-1" /> Menor USD
                          </Badge>
                        )}
                        {eEurMin && (
                          <Badge className="bg-amber-500 hover:bg-amber-600">
                            <Trophy className="h-3 w-3 mr-1" /> Menor EUR
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {historico.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhuma cotação registrada ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
